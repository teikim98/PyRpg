import sys
sys.set_int_max_str_digits(0)
a, b = input().split()
print(len(str(a ** b)))
