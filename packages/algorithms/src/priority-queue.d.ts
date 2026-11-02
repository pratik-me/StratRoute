/**
 * Min-Heap Priority Queue implementation for pathfinding algorithms.
 * Nodes with lower priority values are popped first.
 */
export interface HeapNode<T> {
    item: T;
    priority: number;
}
export declare class MinPriorityQueue<T> {
    private heap;
    get size(): number;
    isEmpty(): boolean;
    push(item: T, priority: number): void;
    pop(): HeapNode<T> | undefined;
    peek(): HeapNode<T> | undefined;
    clear(): void;
    private bubbleUp;
    private bubbleDown;
}
//# sourceMappingURL=priority-queue.d.ts.map