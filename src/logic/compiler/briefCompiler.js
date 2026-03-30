/**
 * Kenward CMS v2 - Brief DSL Compiler (v2.0.0)
 * Translates .brief / .bas mortgage scripts into executable JSON ASTs.
 * Optimized for BC Mortgage Brokerage compliance.
 */

export function compileBas(source) {
    const lines = source.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    
    // Tail-recursive parser core
    const parse = (remaining, ast = { ruleset: 'Untitled', constants: {}, rules: [] }) => {
        if (remaining.length === 0) return ast;

        const [line, ...rest] = remaining;

        // 1. Header: RULESET: [Name]
        if (line.startsWith('RULESET:')) {
            ast.ruleset = line.split(':')[1].trim();
            return parse(rest, ast);
        }

        // 2. Constants: MAX_TDS = 0.44
        if (line.includes('=') && !line.includes('{')) {
            const [key, val] = line.split('=').map(s => s.trim());
            ast.constants[key] = isNaN(val) ? val.replace(/['"]/g, '') : parseFloat(val);
            return parse(rest, ast);
        }

        // 3. Rule Blocks: RULE: Name { ... }
        if (line.startsWith('RULE:')) {
            const ruleName = line.match(/RULE:\s*(\w+)/)[1];
            const ruleObj = { name: ruleName, properties: {} };
            
            // Internal recursion to grab block properties
            let blockIndex = 0;
            while (rest[blockIndex] && !rest[blockIndex].includes('}')) {
                const [pKey, pVal] = rest[blockIndex].split('=').map(s => s.trim());
                ruleObj.properties[pKey] = pVal.replace(/['"]/g, '');
                blockIndex++;
            }
            
            ast.rules.push(ruleObj);
            return parse(rest.slice(blockIndex + 1), ast);
        }

        return parse(rest, ast);
    };

    try {
        const result = parse(lines);
        console.log(`[briefCompiler] Successfully compiled: ${result.ruleset}`);
        return result;
    } catch (error) {
        console.error('[briefCompiler] Compilation Error:', error.message);
        throw new Error('DSL Syntax Error: Check your .brief file structure.');
    }
}
