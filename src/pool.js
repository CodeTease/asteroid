export class ObjectPool {
    constructor(createFn, initialSize = 100) {
        this.createFn = createFn;
        this.pool = [];
        this.active = [];
        
        // Pre-fill pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }

    get(options = {}) {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        
        // Reset object state if necessary (handled by consumer usually, but we can pass options)
        if (obj.reset) {
            obj.reset(options);
        } else {
             // Basic property copy if no reset method (dangerous if not careful)
             Object.assign(obj, options);
        }
        
        this.active.push(obj);
        return obj;
    }

    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            this.pool.push(obj);
        }
    }
    
    // Release all active objects
    releaseAll() {
        while(this.active.length > 0) {
            this.pool.push(this.active.pop());
        }
    }
    
    // For rendering/updating active objects
    forEachActive(callback) {
        // Iterate backwards to allow safe removal during iteration if needed
        // (Though standard pool usage implies release() is called explicitly)
        for (let i = this.active.length - 1; i >= 0; i--) {
            callback(this.active[i], i);
        }
    }
}
