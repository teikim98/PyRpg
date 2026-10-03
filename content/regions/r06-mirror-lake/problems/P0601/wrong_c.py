def base_fare(distance):
    if distance <= 10:
        return 1200
    return 1200 + (distance - 10) * 100


def solution(age, distance):
    if age < 8:
        print(0)
    elif age >= 65:
        print(base_fare(distance) // 2)
    elif age <= 19:
        print(base_fare(distance) - 300)
    else:
        print(base_fare(distance))
