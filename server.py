import os
import io
import base64
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory, send_file

# Try importing cv2 for AI Super-Resolution
try:
    import cv2
    from cv2 import dnn_superres
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

app = Flask(__name__, static_folder='static', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Cache super-resolution models
sr_models = {}

def get_sr_model(model_name="fsrcnn", scale=2):
    if not CV2_AVAILABLE:
        return None
    key = f"{model_name}_{scale}"
    if key in sr_models:
        return sr_models[key]

    model_filename = f"{model_name.upper()}_x{scale}.pb"
    model_path = os.path.join(MODELS_DIR, model_filename)

    if not os.path.exists(model_path):
        return None

    try:
        sr = dnn_superres.DnnSuperResImpl_create()
        sr.readModel(model_path)
        sr.setModel(model_name.lower(), scale)
        sr_models[key] = sr
        return sr
    except Exception as e:
        print(f"[AI SR] Error loading model {model_filename}: {e}")
        return None

def apply_ai_upscale(cv_img, target_w, target_h):
    """
    Applies lightweight AI Super-Resolution (FSRCNN or ESPCN)
    to upscale the image when target dimensions are larger.
    """
    if not CV2_AVAILABLE:
        return cv2.resize(cv_img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

    cur_h, cur_w = cv_img.shape[:2]
    scale_x = target_w / cur_w
    scale_y = target_h / cur_h
    req_scale = max(scale_x, scale_y)

    # Choose appropriate model scale
    if req_scale > 3.0:
        model_scale = 4
    elif req_scale > 2.0:
        model_scale = 3
    elif req_scale > 1.0:
        model_scale = 2
    else:
        # No upscale needed, downscale directly
        return cv2.resize(cv_img, (target_w, target_h), interpolation=cv2.INTER_AREA)

    sr = get_sr_model("fsrcnn", model_scale) or get_sr_model("espcn", model_scale)

    if sr is not None:
        try:
            print(f"[AI SR] Applying FSRCNN/ESPCN x{model_scale} Super-Resolution...")
            upscaled = sr.upsample(cv_img)
            # Resize from the upscaled dimension to the exact target dimension
            interp = cv2.INTER_AREA if (upscaled.shape[1] >= target_w) else cv2.INTER_LANCZOS4
            return cv2.resize(upscaled, (target_w, target_h), interpolation=interp)
        except Exception as e:
            print(f"[AI SR] Inference failed ({e}), falling back to Lanczos...")

    # Fallback to high-quality Lanczos4
    return cv2.resize(cv_img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

def process_target_to_source(source_img_pil, target_img_pil, fit_mode="cover"):
    """
    Adjusts target image to match source image's exact dimensions (Ws, Hs)
    while strictly preserving the target image's aspect ratio (no distortion).
    Uses AI super-resolution when upscaling is required.
    """
    ws, hs = source_img_pil.size
    wt, ht = target_img_pil.size

    ar_source = ws / hs
    ar_target = wt / ht

    # Convert target PIL image to OpenCV BGR
    target_np = np.array(target_img_pil.convert('RGB'))
    target_bgr = cv2.cvtColor(target_np, cv2.COLOR_RGB2BGR) if CV2_AVAILABLE else None

    # Determine scaling factors without distortion
    scale_x = ws / wt
    scale_y = hs / ht

    if fit_mode == "cover":
        # Cover: scale such that target covers the entire source box (suitable side matches)
        scale = max(scale_x, scale_y)
    else:
        # Contain: scale such that target fits completely within source box
        scale = min(scale_x, scale_y)

    scaled_w = max(1, int(round(wt * scale)))
    scaled_h = max(1, int(round(ht * scale)))

    # Perform AI upscale or downscale
    if scale > 1.0 and CV2_AVAILABLE and target_bgr is not None:
        scaled_bgr = apply_ai_upscale(target_bgr, scaled_w, scaled_h)
        scaled_rgb = cv2.cvtColor(scaled_bgr, cv2.COLOR_BGR2RGB)
        scaled_target_pil = Image.fromarray(scaled_rgb)
    else:
        interp = Image.Resampling.LANCZOS if scale > 1.0 else Image.Resampling.BOX
        scaled_target_pil = target_img_pil.convert('RGB').resize((scaled_w, scaled_h), interp)

    # Place onto final Ws x Hs canvas
    final_target = Image.new("RGB", (ws, hs), (0, 0, 0))

    if fit_mode == "cover":
        # Center crop into (ws, hs)
        offset_x = (scaled_w - ws) // 2
        offset_y = (scaled_h - hs) // 2
        cropped = scaled_target_pil.crop((offset_x, offset_y, offset_x + ws, offset_y + hs))
        final_target.paste(cropped, (0, 0))
    else:
        # Center contain with black padding
        offset_x = (ws - scaled_w) // 2
        offset_y = (hs - scaled_h) // 2
        final_target.paste(scaled_target_pil, (offset_x, offset_y))

    return source_img_pil.convert('RGB'), final_target

def pil_to_data_url(pil_img, format="PNG"):
    buffer = io.BytesIO()
    pil_img.save(buffer, format=format)
    b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    mime = "image/png" if format == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{b64}"

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/prepare', methods=['POST'])
def prepare_images():
    if 'source' not in request.files or 'target' not in request.files:
        return jsonify({'error': 'Source and Target images are required.'}), 400

    source_file = request.files['source']
    target_file = request.files['target']
    fit_mode = request.form.get('fit_mode', 'cover')

    try:
        source_pil = Image.open(source_file.stream)
        target_pil = Image.open(target_file.stream)

        # Process target to match source dimensions preserving aspect ratio
        processed_source, processed_target = process_target_to_source(
            source_pil, target_pil, fit_mode=fit_mode
        )

        w, h = processed_source.size
        ai_used = CV2_AVAILABLE and len(sr_models) > 0 or (CV2_AVAILABLE and os.path.exists(MODELS_DIR) and any(f.endswith('.pb') for f in os.listdir(MODELS_DIR)))

        return jsonify({
            'success': True,
            'width': w,
            'height': h,
            'total_pixels': w * h,
            'source_data_url': pil_to_data_url(processed_source),
            'target_data_url': pil_to_data_url(processed_target),
            'ai_upscale_available': CV2_AVAILABLE,
            'ai_models_loaded': list(sr_models.keys()),
            'message': f"Images prepared successfully ({w}x{h}, {w*h} pixels)."
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/optimize-gpu', methods=['POST'])
def optimize_gpu():
    if 'source' not in request.files or 'target' not in request.files:
        return jsonify({'error': 'Source and Target images are required.'}), 400

    source_file = request.files['source']
    target_file = request.files['target']
    fit_mode = request.form.get('fit_mode', 'cover')
    is_auto = request.form.get('is_auto', 'true').lower() == 'true'
    min_steps = int(request.form.get('min_steps', '100000'))
    opt_mode = request.form.get('opt_mode', '5d_sliced')

    try:
        source_pil = Image.open(source_file.stream)
        target_pil = Image.open(target_file.stream)

        # Preprocess target to match source dimensions preserving aspect ratio
        processed_source, processed_target = process_target_to_source(
            source_pil, target_pil, fit_mode=fit_mode
        )

        w, h = processed_source.size
        src_np = np.array(processed_source).reshape(-1, 3)
        tgt_np = np.array(processed_target).reshape(-1, 3)

        # Import GPU optimizer
        try:
            import gpu_optimizer
            dest_map, stats = gpu_optimizer.optimize_intermediate_gpu(
                src_np, tgt_np, w, h, min_steps=min_steps, is_auto=is_auto, opt_mode=opt_mode
            )
        except Exception as opt_err:
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'GPU Optimization error: {str(opt_err)}'}), 500

        return jsonify({
            'success': True,
            'width': w,
            'height': h,
            'total_pixels': w * h,
            'destination_map': dest_map,
            'source_data_url': pil_to_data_url(processed_source),
            'target_data_url': pil_to_data_url(processed_target),
            'stats': stats
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/export-gif', methods=['POST'])
def export_gif():
    try:
        data = request.get_json(force=True)
        frames_base64 = data.get('frames', [])
        duration = int(data.get('duration', 100))  # 100ms * 70 frames = 7000ms = 7.0s
        algo = data.get('algo', 'sort')

        if not frames_base64 or len(frames_base64) < 2:
            return jsonify({'error': 'At least 2 frames required.'}), 400

        pil_frames = []
        for item in frames_base64:
            if ',' in item:
                item = item.split(',', 1)[1]
            img_bytes = base64.b64decode(item)
            frame_img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
            # Adaptive 256-color palette quantization for small size and high quality
            p_frame = frame_img.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
            pil_frames.append(p_frame)

        output_io = io.BytesIO()
        pil_frames[0].save(
            output_io,
            format='GIF',
            save_all=True,
            append_images=pil_frames[1:],
            duration=duration,
            loop=0,
            optimize=True
        )
        output_io.seek(0)

        filename = f'pixelator_{algo}_7s.gif'
        return send_file(
            output_io,
            mimetype='image/gif',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate GIF: {str(e)}'}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    available_models = []
    if os.path.exists(MODELS_DIR):
        available_models = [f for f in os.listdir(MODELS_DIR) if f.endswith('.pb')]
    
    cuda_available = False
    device_name = "None"
    try:
        import gpu_optimizer
        cuda_available = gpu_optimizer.CUDA_AVAILABLE
        device_name = gpu_optimizer.DEVICE_NAME
    except Exception:
        pass

    return jsonify({
        'status': 'online',
        'cv2_available': CV2_AVAILABLE,
        'cuda_available': cuda_available,
        'device_name': device_name,
        'models': available_models
    })

if __name__ == '__main__':
    print("====================================================")
    print("  Pixelator Server starting on http://127.0.0.1:5000")
    print("====================================================")
    app.run(host='127.0.0.1', port=5000, debug=False)
