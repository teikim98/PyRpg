def base_fare(distance):
    if distance > 10:
        return 1200 + (distance - 10) * 100
    fare = 1200


def solution(age, distance):
    if age < 8:
        return 0
    base = base_fare(distance)
    if age >= 65:
        return base // 2
    if age <= 19:
        return base - 300
    return base
