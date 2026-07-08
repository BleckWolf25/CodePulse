function calculate(a, b) {
    let result = 0;
    if (a > b) {
        for (let i = 0; i < a; i++) {
            result += i;
        }
    } else {
        result = b;
    }
    return result;
}
