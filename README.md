# Pixelator

A pixel sorting simulator that rearranges pixels from a source image to reproduce a target image using sorting algorithms under strict pixel conservation (permutations only).

## Requirements

- Windows 10 / 11
- Python 3.10+ (CUDA-enabled PyTorch recommended for NVIDIA GPU acceleration)
- Modern web browser (Chrome, Edge, Firefox)

## Getting Started

1. Clone the repository:
   ```cmd
   git clone https://github.com/yngboson/pixelaotr.git
   cd pixelaotr
   ```

2. Run the launcher:
   ```cmd
   run.bat
   ```
   - The script automatically detects an existing CUDA PyTorch Python environment.
   - If no suitable environment is found, it runs `setup.bat` to set up the standalone Python runtime.
   - The web interface opens automatically at `http://127.0.0.1:5000`.

## How to Use

1. Image Input and Optimization
   - Default source and target images are loaded automatically on launch.
   - You can also upload your own source and target images.
   - Choose the intermediate optimization mode:
     - 5D Spatiotemporal Optimal Transport: Balances spatial contours and color distribution.
     - 3D RGB Vector Matching: Automatically converges to the local minimum in 3D color space.
   - Click "Prepare & Optimize Intermediate Image" to compute the pixel destination map (~0.2-0.5s on GPU).

2. Sorting Visualization
   - Select a sorting algorithm from the dropdown (e.g., 2D Spatial QuickSort, 2D Spatial MergeSort).
   - Keep the default adaptive speed control (240,000 swaps/s at 75 FPS) or adjust the target rate.
   - Click "Start Sorting" to visualize the step-by-step pixel rearrangement process.
   - Click "Export 7s GIF" to render and download a 7.0-second animated GIF showing the entire sorting transformation.
