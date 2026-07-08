def calculate(a, b):
    result = 0
    if a > b:
        for i in range(a):
            result += i
    else:
        result = b
    return result
