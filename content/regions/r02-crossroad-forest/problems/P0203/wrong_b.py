y = int(input())
if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0:
    print("윤년")
else:
    print("평년")
