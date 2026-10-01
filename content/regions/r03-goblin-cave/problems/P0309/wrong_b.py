def solution(numbers):
    sums = []
    for i in range(len(numbers)):
        for j in range(i + 1, len(numbers)):
            sums.append(numbers[i] + numbers[j])
    return sorted(sums)
