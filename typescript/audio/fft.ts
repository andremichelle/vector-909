export const fft = (dir: number, m: number, x: Float32Array, y: Float32Array): void => {
    let c1, c2, tx, ty, t1, t2, u1, u2, z
    let n = 1
    for (let i = 0; i < m; i++) {
        n *= 2
    }
    const i2 = n >> 1
    let j = 0
    for (let i = 0; i < n - 1; i++) {
        if (i < j) {
            tx = x[i]
            ty = y[i]
            x[i] = x[j]
            y[i] = y[j]
            x[j] = tx
            y[j] = ty
        }
        let k = i2
        while (k <= j) {
            j -= k
            k >>= 1
        }
        j += k
    }
    c1 = -1.0
    c2 = 0.0
    let l2 = 1
    for (let l = 0; l < m; l++) {
        const l1 = l2
        l2 <<= 1
        u1 = 1.0
        u2 = 0.0
        for (j = 0; j < l1; j++) {
            for (let i = j; i < n; i += l2) {
                const i1 = i + l1
                t1 = u1 * x[i1] - u2 * y[i1]
                t2 = u1 * y[i1] + u2 * x[i1]
                x[i1] = x[i] - t1
                y[i1] = y[i] - t2
                x[i] += t1
                y[i] += t2
            }
            z = u1 * c1 - u2 * c2
            u2 = u1 * c2 + u2 * c1
            u1 = z
        }
        c2 = Math.sqrt((1.0 - c1) / 2.0)
        if (dir === 1) {
            c2 = -c2
        }
        c1 = Math.sqrt((1.0 + c1) / 2.0)
    }
    if (dir === 1) {
        for (let i = 0; i < n; i++) {
            x[i] /= n
            y[i] /= n
        }
    }
}