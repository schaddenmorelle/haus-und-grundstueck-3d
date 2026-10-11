import numpy as np, cv2
im=cv2.imread('dg0_full.png'); h,w=im.shape[:2]
g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
dark=(g<90).astype(np.uint8)
# thick black outline
th=cv2.morphologyEx(dark,cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
n,lab,st,_=cv2.connectedComponentsWithStats(th,8)
big=max(range(1,n),key=lambda i:st[i,4]); print('outline',st[big])
o=(lab==big).astype(np.uint8)
cnts,_=cv2.findContours(o,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
for c in cnts:
    a=cv2.approxPolyDP(c,4,True)[:,0,:]
    print(len(a),cv2.contourArea(c)); print(a.tolist() if len(a)<30 else a[:30].tolist())
# chain end ticks for 12.95 line top: find extent of the horizontal dim line near y~44*1.399
