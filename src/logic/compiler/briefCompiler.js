export function compileBas(sourceCode) {
    console.log("[briefCompiler] Compiling .bas script...");
    return { compiledAt: new Date().toISOString(), source: sourceCode };
}
