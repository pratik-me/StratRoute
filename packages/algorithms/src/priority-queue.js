export class MinPriorityQueue {
    heap = [];
    get size() {
        return this.heap.length;
    }
    isEmpty() {
        return this.heap.length === 0;
    }
    push(item, priority) {
        this.heap.push({ item, priority });
        this.bubbleUp(this.heap.length - 1);
    }
    pop() {
        if (this.heap.length === 0)
            return undefined;
        const top = this.heap[0];
        const bottom = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            this.bubbleDown(0);
        }
        return top;
    }
    peek() {
        return this.heap[0];
    }
    clear() {
        this.heap = [];
    }
    bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index].priority < this.heap[parentIndex].priority) {
                const temp = this.heap[index];
                this.heap[index] = this.heap[parentIndex];
                this.heap[parentIndex] = temp;
                index = parentIndex;
            }
            else {
                break;
            }
        }
    }
    bubbleDown(index) {
        const length = this.heap.length;
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;
            if (leftChild < length &&
                this.heap[leftChild].priority < this.heap[smallest].priority) {
                smallest = leftChild;
            }
            if (rightChild < length &&
                this.heap[rightChild].priority < this.heap[smallest].priority) {
                smallest = rightChild;
            }
            if (smallest !== index) {
                const temp = this.heap[index];
                this.heap[index] = this.heap[smallest];
                this.heap[smallest] = temp;
                index = smallest;
            }
            else {
                break;
            }
        }
    }
}
//# sourceMappingURL=priority-queue.js.map