/**
 * algorithms.js - Pixel Sorting & Transformation Engine
 * 
 * Phase 1: Hill Climbing Random Swap for Intermediate Target Generation (Internal)
 * Phase 2: Classic Sorting Algorithms (Quick, Merge, Heap, Shell, etc.) on Pixels
 * 
 * Strict Constraint: All transformations use ONLY swaps. Pixel color palette is 100% conserved.
 */

// Color distance squared between two 32-bit RGBA packed integers (ABGR little-endian)
function colorDistSq(c1, c2) {
    const r1 = c1 & 0xFF;
    const g1 = (c1 >> 8) & 0xFF;
    const b1 = (c1 >> 16) & 0xFF;

    const r2 = c2 & 0xFF;
    const g2 = (c2 >> 8) & 0xFF;
    const b2 = (c2 >> 16) & 0xFF;

    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
}

// Calculate mean sampled color distance between two pixel buffers
function calculateMeanDistanceSampled(pixelsA, pixelsB, totalPixels, samples = 1500) {
    let sum = 0;
    const step = Math.max(1, Math.floor(totalPixels / samples));
    let count = 0;
    for (let i = 0; i < totalPixels; i += step) {
        sum += Math.sqrt(colorDistSq(pixelsA[i], pixelsB[i]));
        count++;
    }
    return count > 0 ? sum / count : 0;
}

// ============================================================================
// Phase 1: Hill Climbing Optimizer for Intermediate Target Generation
// ============================================================================

class HillClimbingOptimizer {
    constructor(width, height, sourcePixels, targetPixels, options = {}) {
        this.width = width;
        this.height = height;
        this.totalPixels = width * height;

        // Working pixel buffer (starts with source pixels)
        this.currentPixels = new Uint32Array(sourcePixels);
        this.targetPixels = new Uint32Array(targetPixels);

        // Tracks which original source index is currently at each position
        // mapping[pos] = originalSourceIndex
        this.mapping = new Int32Array(this.totalPixels);
        for (let i = 0; i < this.totalPixels; i++) {
            this.mapping[i] = i;
        }

        // Configuration
        this.isAutoMinSteps = options.isAutoMinSteps ?? true;
        this.manualMinSteps = options.manualMinSteps || 100000;
        this.minSteps = this.calculateMinSteps();

        this.stepsDone = 0;
        this.totalSwaps = 0;
        this.isCompleted = false;

        this.initialDistance = calculateMeanDistanceSampled(this.currentPixels, this.targetPixels, this.totalPixels);
        this.currentDistance = this.initialDistance;

        // Convergence tracking
        this.windowSize = 25000;
        this.lastWindowDistance = this.initialDistance;
        this.improvementThreshold = 0.0002; // Stop when window improvement is below 0.02%
    }

    calculateMinSteps() {
        if (!this.isAutoMinSteps) {
            return this.manualMinSteps;
        }
        // Auto calculation based on pixel count
        // Higher resolution requires proportionally more exploratory swaps
        return Math.max(50000, Math.min(5000000, this.totalPixels * 25));
    }

    /**
     * Executes a chunk of hill climbing trials.
     * Returns true if optimization has completed, false if more work is needed.
     */
    runChunk(chunkSize = 50000) {
        if (this.isCompleted) return true;

        const w = this.width;
        const h = this.height;
        const n = this.totalPixels;
        const cur = this.currentPixels;
        const tgt = this.targetPixels;
        const map = this.mapping;

        // Dynamic spatial radius for exploration
        const progressRatio = Math.min(1.0, this.stepsDone / this.minSteps);
        const radius = Math.max(2, Math.floor(Math.min(w, h) * (0.05 + 0.95 * Math.pow(1.0 - progressRatio, 1.5))));

        let successfulSwaps = 0;

        for (let t = 0; t < chunkSize; t++) {
            const i = Math.floor(Math.random() * n);
            let j;

            if (Math.random() < 0.65) {
                // Local search around i
                const ix = i % w;
                const iy = Math.floor(i / w);
                const dx = Math.floor((Math.random() - 0.5) * 2 * radius);
                const dy = Math.floor((Math.random() - 0.5) * 2 * radius);
                const jx = Math.max(0, Math.min(w - 1, ix + dx));
                const jy = Math.max(0, Math.min(h - 1, iy + dy));
                j = jy * w + jx;
            } else {
                // Global exploratory swap
                j = Math.floor(Math.random() * n);
            }

            if (i === j) continue;

            const c_i = cur[i];
            const c_j = cur[j];
            if (c_i === c_j) continue;

            const t_i = tgt[i];
            const t_j = tgt[j];

            const curDist = colorDistSq(c_i, t_i) + colorDistSq(c_j, t_j);
            const newDist = colorDistSq(c_j, t_i) + colorDistSq(c_i, t_j);

            // Accept swap only if it strictly reduces color distance
            if (newDist < curDist) {
                cur[i] = c_j;
                cur[j] = c_i;

                const tmpMap = map[i];
                map[i] = map[j];
                map[j] = tmpMap;

                successfulSwaps++;
            }
        }

        this.stepsDone += chunkSize;
        this.totalSwaps += successfulSwaps;

        // Check convergence periodically
        if (this.stepsDone % this.windowSize === 0) {
            this.currentDistance = calculateMeanDistanceSampled(cur, tgt, n);
            const windowImprovement = (this.lastWindowDistance - this.currentDistance) / Math.max(1, this.lastWindowDistance);
            this.lastWindowDistance = this.currentDistance;

            // Stop only after passing minSteps AND window improvement has diminished
            if (this.stepsDone >= this.minSteps) {
                if (windowImprovement <= this.improvementThreshold || successfulSwaps === 0) {
                    this.isCompleted = true;
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Extracts destination indices for each original source pixel.
     * returns Int32Array destIndices where destIndices[originalSourceIndex] = finalPositionIndex
     */
    getDestinationMap() {
        const destIndices = new Int32Array(this.totalPixels);
        for (let pos = 0; pos < this.totalPixels; pos++) {
            const originalIndex = this.mapping[pos];
            destIndices[originalIndex] = pos;
        }
        return destIndices;
    }
}

// ============================================================================
// Phase 2: Classic Sorting Simulator Engine (Generator-based for Visualization)
// ============================================================================

class SortingEngine {
    constructor(width, height, initialPixels, destinationIndices, algorithmName = 'quick_sort') {
        this.width = width;
        this.height = height;
        this.totalPixels = width * height;

        // Current working pixel buffer (starts with source pixels)
        this.currentPixels = new Uint32Array(initialPixels);
        this.initialPixels = new Uint32Array(initialPixels);

        // Sorting keys: keys[pos] is where the pixel currently at 'pos' belongs
        this.keys = new Int32Array(destinationIndices);
        this.initialKeys = new Int32Array(destinationIndices);

        // Pre-allocated reusable slot buffer for zero-allocation sub-region sorting
        this.slotBuffer = new Int32Array(this.totalPixels);

        // O(1) incremental sorted pixels tracker
        this.sortedPixelsCount = 0;
        for (let i = 0; i < this.totalPixels; i++) {
            if (this.keys[i] === i) this.sortedPixelsCount++;
        }

        this.totalSwaps = 0;
        this.isDone = false;
        this.generator = this.createSortGenerator();
    }

    inlineSwap(i, j) {
        if (i === j) return;

        const ki = this.keys[i];
        const kj = this.keys[j];

        // Incremental O(1) sorted count update
        if (ki === i) this.sortedPixelsCount--;
        if (kj === j) this.sortedPixelsCount--;

        this.keys[i] = kj;
        this.keys[j] = ki;

        if (kj === i) this.sortedPixelsCount++;
        if (ki === j) this.sortedPixelsCount++;

        const pi = this.currentPixels[i];
        this.currentPixels[i] = this.currentPixels[j];
        this.currentPixels[j] = pi;

        this.totalSwaps++;
    }

    *swap(i, j) {
        if (i === j) return;
        this.inlineSwap(i, j);
        yield;
    }

    createSortGenerator() {
        switch (this.algorithmName) {
            case 'spatial_quick_sort':
                return this.generator2DSpatialQuickSort();
            case 'spatial_merge_sort':
                return this.generator2DSpatialMergeSort();
            case 'row_quick_sort':
                return this.generatorRowByRowSort();
            case 'quick_sort':
                return this.generatorQuickSort(0, this.totalPixels - 1);
            case 'merge_sort':
                return this.generatorMergeSort(0, this.totalPixels - 1);
            case 'heap_sort':
                return this.generatorHeapSort();
            case 'shell_sort':
                return this.generatorShellSort();
            case 'cocktail_sort':
                return this.generatorCocktailSort();
            case 'cycle_sort':
                return this.generatorCycleSort();
            case 'bubble_sort':
                return this.generatorBubbleSort();
            case 'selection_sort':
                return this.generatorSelectionSort();
            default:
                return this.generator2DSpatialQuickSort();
        }
    }

    /**
     * Executes up to `batchSize` swaps from the sorting generator.
     */
    step(batchSize) {
        if (this.isDone) return 0;

        let swapsThisStep = 0;
        while (swapsThisStep < batchSize) {
            const next = this.generator.next();
            if (next.done) {
                this.isDone = true;
                break;
            }
            swapsThisStep++;
        }
        return swapsThisStep;
    }

    countSortedPixels() {
        return this.sortedPixelsCount;
    }

    // --- 0. Zero-Allocation 2D Spatial Partitioning QuickSort (BFS with Typed Queue) ---
    *generator2DSpatialQuickSort() {
        const W = this.width;
        const H = this.height;

        // Pre-allocated typed queue for regions (x1, y1, x2, y2)
        // Eliminates all array allocations and queue.shift() O(N) penalties
        let qCap = 65536 * 4;
        let queue = new Int32Array(qCap);
        let qHead = 0;
        let qTail = 0;

        // Push initial full image region
        queue[qTail++] = 0;
        queue[qTail++] = 0;
        queue[qTail++] = W - 1;
        queue[qTail++] = H - 1;

        const pushRegion = (x1, y1, x2, y2) => {
            if (qTail + 4 >= qCap) {
                // Grow typed queue if needed
                const newQ = new Int32Array(qCap * 2);
                newQ.set(queue.subarray(qHead, qTail));
                qTail -= qHead;
                qHead = 0;
                qCap *= 2;
                queue = newQ;
            }
            queue[qTail++] = x1;
            queue[qTail++] = y1;
            queue[qTail++] = x2;
            queue[qTail++] = y2;
        };

        while (qHead < qTail) {
            const x1 = queue[qHead++];
            const y1 = queue[qHead++];
            const x2 = queue[qHead++];
            const y2 = queue[qHead++];

            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            if (w <= 1 && h <= 1) continue;

            if (w >= h) {
                // Split horizontally (X-axis) into Left [x1..midX] and Right [midX+1..x2]
                const midX = Math.floor((x1 + x2) / 2);

                let lx = x1, ly = y1;
                let rx = midX + 1, ry = y1;

                while (ly <= y2 && ry <= y2) {
                    // Find next left slot with pixel belonging to right (destX > midX)
                    while (ly <= y2) {
                        const pos = ly * W + lx;
                        if ((this.keys[pos] % W) > midX) break;
                        lx++;
                        if (lx > midX) { lx = x1; ly++; }
                    }

                    // Find next right slot with pixel belonging to left (destX <= midX)
                    while (ry <= y2) {
                        const pos = ry * W + rx;
                        if ((this.keys[pos] % W) <= midX) break;
                        rx++;
                        if (rx > x2) { rx = midX + 1; ry++; }
                    }

                    if (ly <= y2 && ry <= y2) {
                        this.inlineSwap(ly * W + lx, ry * W + rx);
                        yield;
                        lx++;
                        if (lx > midX) { lx = x1; ly++; }
                        rx++;
                        if (rx > x2) { rx = midX + 1; ry++; }
                    }
                }

                pushRegion(x1, y1, midX, y2);
                pushRegion(midX + 1, y1, x2, y2);

            } else {
                // Split vertically (Y-axis) into Top [y1..midY] and Bottom [midY+1..y2]
                const midY = Math.floor((y1 + y2) / 2);

                let tx = x1, ty = y1;
                let bx = x1, by = midY + 1;

                while (ty <= midY && by <= y2) {
                    // Find next top slot with pixel belonging to bottom (destY > midY)
                    while (ty <= midY) {
                        const pos = ty * W + tx;
                        if (Math.floor(this.keys[pos] / W) > midY) break;
                        tx++;
                        if (tx > x2) { tx = x1; ty++; }
                    }

                    // Find next bottom slot with pixel belonging to top (destY <= midY)
                    while (by <= y2) {
                        const pos = by * W + bx;
                        if (Math.floor(this.keys[pos] / W) <= midY) break;
                        bx++;
                        if (bx > x2) { bx = x1; by++; }
                    }

                    if (ty <= midY && by <= y2) {
                        this.inlineSwap(ty * W + tx, by * W + bx);
                        yield;
                        tx++;
                        if (tx > x2) { tx = x1; ty++; }
                        bx++;
                        if (bx > x2) { bx = x1; by++; }
                    }
                }

                pushRegion(x1, y1, x2, midY);
                pushRegion(x1, midY + 1, x2, y2);
            }
        }
    }

    // --- 0-B. 2D Spatial Partitioning MergeSort (Bottom-up Quadtree style) ---
    *generator2DSpatialMergeSort() {
        yield* this.spatialMergeRecurse(0, 0, this.width - 1, this.height - 1);
    }

    *spatialMergeRecurse(x1, y1, x2, y2) {
        const w = x2 - x1 + 1;
        const h = y2 - y1 + 1;
        if (w <= 1 && h <= 1) return;

        const W = this.width;

        if (w >= h) {
            const midX = Math.floor((x1 + x2) / 2);
            yield* this.spatialMergeRecurse(x1, y1, midX, y2);
            yield* this.spatialMergeRecurse(midX + 1, y1, x2, y2);

            let count = 0;
            for (let y = y1; y <= y2; y++) {
                const row = y * W;
                for (let x = x1; x <= x2; x++) {
                    this.slotBuffer[count++] = row + x;
                }
            }
            yield* this.sortSlotIndices(this.slotBuffer, count, 'merge');
        } else {
            const midY = Math.floor((y1 + y2) / 2);
            yield* this.spatialMergeRecurse(x1, y1, x2, midY);
            yield* this.spatialMergeRecurse(x1, midY + 1, x2, y2);

            let count = 0;
            for (let y = y1; y <= y2; y++) {
                const row = y * W;
                for (let x = x1; x <= x2; x++) {
                    this.slotBuffer[count++] = row + x;
                }
            }
            yield* this.sortSlotIndices(this.slotBuffer, count, 'merge');
        }
    }

    // --- 0-C. Row-by-Row QuickSort (Horizontal Scanline style) ---
    *generatorRowByRowSort() {
        const W = this.width;
        const H = this.height;

        for (let targetY = 0; targetY < H; targetY++) {
            const rowStart = targetY * W;
            const rowEnd = rowStart + W - 1;

            let searchPos = rowEnd + 1;
            for (let x = 0; x < W; x++) {
                const curPos = rowStart + x;
                const curDestY = Math.floor(this.keys[curPos] / W);

                if (curDestY !== targetY) {
                    while (searchPos < this.totalPixels) {
                        if (Math.floor(this.keys[searchPos] / W) === targetY) {
                            yield* this.swap(curPos, searchPos);
                            searchPos++;
                            break;
                        }
                        searchPos++;
                    }
                }
            }

            yield* this.generatorQuickSort(rowStart, rowEnd);
        }
    }

    *sortSlotIndices(slots, n, algo = 'quick') {
        if (n <= 1) return;

        if (algo === 'quick') {
            const stack = [[0, n - 1]];
            while (stack.length > 0) {
                const [l, r] = stack.pop();
                if (l >= r) continue;

                const pivot = this.keys[slots[Math.floor((l + r) / 2)]];
                let i = l - 1;
                let j = r + 1;

                while (true) {
                    do { i++; } while (this.keys[slots[i]] < pivot);
                    do { j--; } while (this.keys[slots[j]] > pivot);
                    if (i >= j) break;
                    yield* this.swap(slots[i], slots[j]);
                }

                stack.push([j + 1, r]);
                stack.push([l, j]);
            }
        } else {
            for (let size = 1; size < n; size = size * 2) {
                for (let left = 0; left < n - size; left += 2 * size) {
                    let mid = left + size - 1;
                    const right = Math.min(left + 2 * size - 1, n - 1);

                    let s1 = left;
                    let s2 = mid + 1;
                    if (this.keys[slots[mid]] <= this.keys[slots[s2]]) continue;

                    while (s1 <= mid && s2 <= right) {
                        if (this.keys[slots[s1]] <= this.keys[slots[s2]]) {
                            s1++;
                        } else {
                            let idx = s2;
                            while (idx !== s1) {
                                yield* this.swap(slots[idx], slots[idx - 1]);
                                idx--;
                            }
                            s1++;
                            mid++;
                            s2++;
                        }
                    }
                }
            }
        }
    }

    // --- 1. QuickSort (Hoare Partition) ---
    *generatorQuickSort(low, high) {
        const stack = [[low, high]];

        while (stack.length > 0) {
            const [l, r] = stack.pop();
            if (l >= r) continue;

            const pivot = this.keys[Math.floor((l + r) / 2)];
            let i = l - 1;
            let j = r + 1;

            while (true) {
                do { i++; } while (this.keys[i] < pivot);
                do { j--; } while (this.keys[j] > pivot);

                if (i >= j) break;

                yield* this.swap(i, j);
            }

            stack.push([j + 1, r]);
            stack.push([l, j]);
        }
    }

    // --- 2. MergeSort (In-place Block / Rotation Merge) ---
    *generatorMergeSort(l, r) {
        for (let size = 1; size <= (r - l); size = size * 2) {
            for (let left = l; left < r; left += 2 * size) {
                const mid = Math.min(left + size - 1, r);
                const right = Math.min(left + 2 * size - 1, r);
                yield* this.inPlaceMerge(left, mid, right);
            }
        }
    }

    *inPlaceMerge(start, mid, end) {
        let start2 = mid + 1;
        if (this.keys[mid] <= this.keys[start2]) return;

        while (start <= mid && start2 <= end) {
            if (this.keys[start] <= this.keys[start2]) {
                start++;
            } else {
                let index = start2;
                // Shift elements using swaps to preserve strict swap constraint
                while (index !== start) {
                    yield* this.swap(index, index - 1);
                    index--;
                }
                start++;
                mid++;
                start2++;
            }
        }
    }

    // --- 3. HeapSort ---
    *generatorHeapSort() {
        const n = this.totalPixels;

        // Build max heap
        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
            yield* this.heapify(n, i);
        }

        // Extract elements one by one
        for (let i = n - 1; i > 0; i--) {
            yield* this.swap(0, i);
            yield* this.heapify(i, 0);
        }
    }

    *heapify(n, i) {
        let largest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;

        if (left < n && this.keys[left] > this.keys[largest]) {
            largest = left;
        }
        if (right < n && this.keys[right] > this.keys[largest]) {
            largest = right;
        }

        if (largest !== i) {
            yield* this.swap(i, largest);
            yield* this.heapify(n, largest);
        }
    }

    // --- 4. ShellSort (Ciura Gap Sequence) ---
    *generatorShellSort() {
        const n = this.totalPixels;
        const gaps = [701, 301, 132, 57, 23, 10, 4, 1];

        for (const gap of gaps) {
            if (gap >= n) continue;

            for (let i = gap; i < n; i++) {
                let j = i;
                while (j >= gap && this.keys[j - gap] > this.keys[j]) {
                    yield* this.swap(j, j - gap);
                    j -= gap;
                }
            }
        }
    }

    // --- 5. Cocktail Shaker Sort ---
    *generatorCocktailSort() {
        let start = 0;
        let end = this.totalPixels - 1;
        let swapped = true;

        while (swapped) {
            swapped = false;

            for (let i = start; i < end; ++i) {
                if (this.keys[i] > this.keys[i + 1]) {
                    yield* this.swap(i, i + 1);
                    swapped = true;
                }
            }

            if (!swapped) break;
            swapped = false;
            end--;

            for (let i = end - 1; i >= start; --i) {
                if (this.keys[i] > this.keys[i + 1]) {
                    yield* this.swap(i, i + 1);
                    swapped = true;
                }
            }
            start++;
        }
    }

    // --- 6. Cycle Sort (Permutation Cycle Decomposition - Minimum Swaps) ---
    *generatorCycleSort() {
        const n = this.totalPixels;
        for (let i = 0; i < n; i++) {
            while (this.keys[i] !== i) {
                yield* this.swap(i, this.keys[i]);
            }
        }
    }

    // --- 7. BubbleSort ---
    *generatorBubbleSort() {
        const n = this.totalPixels;
        for (let i = 0; i < n - 1; i++) {
            let swapped = false;
            for (let j = 0; j < n - i - 1; j++) {
                if (this.keys[j] > this.keys[j + 1]) {
                    yield* this.swap(j, j + 1);
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
    }

    // --- 8. SelectionSort ---
    *generatorSelectionSort() {
        const n = this.totalPixels;
        for (let i = 0; i < n - 1; i++) {
            let minIdx = i;
            for (let j = i + 1; j < n; j++) {
                if (this.keys[j] < this.keys[minIdx]) {
                    minIdx = j;
                }
            }
            if (minIdx !== i) {
                yield* this.swap(i, minIdx);
            }
        }
    }
}

// Export classes to global window
window.HillClimbingOptimizer = HillClimbingOptimizer;
window.SortingEngine = SortingEngine;
