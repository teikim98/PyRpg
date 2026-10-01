def solution(numbers):
    sums = []
    for i in range(len(numbers)):
        for j in range(i, len(numbers)):
            s = numbers[i] + numbers[j]
            if s not in sums:
                sums.append(s)
    return sorted(sums)
