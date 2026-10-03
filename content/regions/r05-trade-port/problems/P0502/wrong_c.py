def solution(goods):
    lo_name, lo_price = goods[0]
    hi_name, hi_price = goods[0]
    for name, price in goods:
        if price < lo_price:
            lo_name, lo_price = name, price
        if price > hi_price:
            hi_name, hi_price = name, price
    return lo_name
    return hi_name
