s = input().strip()
b_seen = 0
pairs = 0
for ch in s:
    if ch == "B":
        b_seen += 1
    else:
        pairs += b_seen
print(pairs)
