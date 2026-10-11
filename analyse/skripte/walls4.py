import numpy as np, cv2, json
O=(1020,867); S=117.8
im=cv2.imread('/root/.claude/uploads/3119549e-b240-5b00-9943-53178070c7de/32710f5f-image.png')
dark=(im.max(axis=2)<135).astype(np.uint8)
cl=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
op=cv2.morphologyEx(cl,cv2.MORPH_OPEN,np.ones((11,11),np.uint8))
R=np.zeros_like(op); R[880:2620,1030:2570]=1; op&=R
n,lab,st,_=cv2.connectedComponentsWithStats(op,8)
for i in range(1,n):
    if st[i,4]<1500: op[lab==i]=0
cv2.imwrite('mask2.png',op*255)
H=cv2.morphologyEx(op,cv2.MORPH_OPEN,np.ones((11,45),np.uint8))
V=cv2.morphologyEx(op,cv2.MORPH_OPEN,np.ones((45,11),np.uint8))
rest=op&~cv2.dilate(H|V,np.ones((7,7),np.uint8))
rest=cv2.morphologyEx(rest,cv2.MORPH_OPEN,np.ones((7,7),np.uint8))
vis=im.copy(); vis[H>0]=(0,0,255); vis[V>0]=(255,0,0); vis[rest>0]=(0,160,0)
cv2.imwrite('walls_vis2.png',cv2.resize(vis[850:2650,1000:2600],None,fx=0.62,fy=0.62))
np.save('H.npy',H);np.save('V.npy',V);np.save('rest.npy',rest)
