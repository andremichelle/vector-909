enum Segment {
    TT = 1 << 0, TR = 1 << 1, BR = 1 << 2, BB = 1 << 3, BL = 1 << 4, TL = 1 << 5, CR = 1 << 6
}

const Segments = [
    Segment.TT | Segment.BB | Segment.BL | Segment.TL | Segment.BR | Segment.TR,
    Segment.TR | Segment.BR,
    Segment.TT | Segment.BB | Segment.CR | Segment.TR | Segment.BL,
    Segment.TT | Segment.BB | Segment.CR | Segment.TR | Segment.BR,
    Segment.CR | Segment.TR | Segment.TL | Segment.BR,
    Segment.TT | Segment.BB | Segment.CR | Segment.TL | Segment.BR,
    Segment.TT | Segment.BB | Segment.CR | Segment.TL | Segment.BR | Segment.BL,
    Segment.TR | Segment.BR | Segment.TT,
    Segment.TT | Segment.BB | Segment.CR | Segment.TL | Segment.BR | Segment.BL | Segment.TR,
    Segment.TT | Segment.BB | Segment.CR | Segment.TL | Segment.BR | Segment.TR,
]

class Digit {
    constructor(private readonly segments: SVGPathElement[]) {
    }

    clear(): void {
        this.segments.forEach(s => s.classList.toggle('active', false))
    }

    show(value: number): void {
        console.assert(value >= 0 && value <= 9)
        for (let index = 0; index < this.segments.length; index++) {
            this.segments[index].classList.toggle('active', (1 << index & Segments[value]) !== 0)
        }
    }
}

export class Digits {
    private readonly digits: Digit[]

    constructor(svg: SVGSVGElement) {
        this.digits = Array.from(svg.querySelectorAll('g g')).map(g => new Digit(Array.from(g.querySelectorAll('path'))))
    }

    show(value: number): void {
        value = Math.floor(value)
        value
            .toString(10)
            .padStart(3, ' ')
            .split('')
            .forEach((digit: string, index: number) => {
                const integer = parseInt(digit)
                if (isNaN(integer)) {
                    this.digits[index].clear()
                } else {
                    this.digits[index].show(integer)
                }
            })
    }

    clear(): void {
        this.digits.forEach(digit => digit.clear())
    }
}