export type Message =
    | { type: "update-parameter", path: string, unipolar: number }
    | { type: "void" }