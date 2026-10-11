import numpy as np, cv2, json
m=cv2.imread('mask.png',0)>0
# restrict to house region
R=np.zeros_like(m); R[820:2700,960:2620]=True
m=m&R
n,lab,st,cen=cv2.connectedComponentsWithStats(m.astype(np.uint8),8)
for i in range(1,n):
    if st[i,4]>3000: print(i,st[i])
keep=np.zeros_like(m)
for i in range(1,n):
    if st[i,4]>3000: keep|=lab==i
ys,xs=np.where(keep); print('bbox',xs.min(),xs.max(),ys.min(),ys.max(), (xs.max()-xs.min())/12.95,(ys.max()-ys.min())/14.655)
cv2.imwrite('keep.png',keep.astype(np.uint8)*255)
