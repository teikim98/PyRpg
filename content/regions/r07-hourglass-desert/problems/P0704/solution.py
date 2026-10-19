s = input().strip()
a_seen = 0
pairs = 0
for ch in s:
    if ch == "A":
        a_seen += 1
    else:
        pairs += a_seen
print(pairs)
