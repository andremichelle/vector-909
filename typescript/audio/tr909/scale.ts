export class Scale {
    static N6D16 = new Scale(3, 16)
    static N3D8 = new Scale(3, 32)
    static D32 = new Scale(1, 32)
    static D16 = new Scale(1, 16)

    static getByIndex(index: number): Scale {
        console.assert(index >= 0 && index < 4)
        return Scale.Available[index]
    }

    private static Available = [Scale.N6D16, Scale.N3D8, Scale.D32, Scale.D16]

    private constructor(readonly nominator: number, readonly denominator: number) {
    }

    value(): number {
        return this.nominator / this.denominator
    }

    cycleNext(): Scale {
        return Scale.getByIndex((this.index() + Scale.Available.length - 1) % Scale.Available.length)
    }

    index(): number {
        return Scale.Available.indexOf(this)
    }
}