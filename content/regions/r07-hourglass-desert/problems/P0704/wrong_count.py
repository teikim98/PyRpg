s = input().strip()
pairs = 0
for j in range(len(s)):
    if s[j] == "B":
        pairs += s[:j].count("A")
print(pairs)
