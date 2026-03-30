export function findMaxPermittedValue(min, max, checkFunction, precision = 0.01) {
    let low = min, high = max, result = min;
    while ((high - low) > precision) {
        let mid = (low + high) / 2;
        if (checkFunction(mid)) { result = mid; low = mid; } 
        else { high = mid; }
    }
    return parseFloat(result.toFixed(2));
}
