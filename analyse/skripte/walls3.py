import numpy as np, cv2, json
O=(1020,867); S=117.8
m=(cv2.imread('mask.png',0)>0).astype(np.uint8)
R=np.zeros_like(m); R[840:2640,990:2600]=1; m&=R
# remove small comps
n,lab,st,_=cv2.connectedComponentsWithStats(m,8)
for i in range(1,n):
    if st[i,4]<2500: m[lab==i]=0
H=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(70,1)))
V=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(1,70)))
# thickness filter: require >=10px thick
H=cv2.morphologyEx(H,cv2.MORPH_OPEN,np.ones((10,70),np.uint8))
V=cv2.morphologyEx(V,cv2.MORPH_OPEN,np.ones((70,10),np.uint8))
rest=m&~cv2.dilate(H|V,np.ones((5,5),np.uint8))
rest=cv2.morphologyEx(rest,cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
def rects(M,tag):
    n,lab,st,_=cv2.connectedComponentsWithStats(M,8)
    out=[]
    for i in range(1,n):
        x,y,w,h,a=st[i]
        if a<600: continue
        out.append(dict(tag=tag,x0=round((x-O[0])/S,3),x1=round((x+w-O[0])/S,3),z0=round((y-O[1])/S,3),z1=round((y+h-O[1])/S,3),px=[int(x),int(y),int(w),int(h)]))
    return out
rh=rects(H,'H'); rv=rects(V,'V')
for r in rh+rv: print(r['tag'],r['x0'],r['x1'],r['z0'],r['z1'],'t=%.3f'%((r['z1']-r['z0']) if r['tag']=='H' else (r['x1']-r['x0'])))
n,lab,st,_=cv2.connectedComponentsWithStats(rest,8)
print('diag comps')
for i in range(1,n):
    if st[i,4]<800: continue
    pts=np.column_stack(np.where(lab==i))[:,::-1].astype(np.float32)
    rr=cv2.minAreaRect(pts)
    print(i,st[i],rr)
vis=cv2.imread('/root/.claude/uploads/3119549e-b240-5b00-9943-53178070c7de/32710f5f-image.png')
vis[H>0]=(0,0,255); vis[V>0]=(255,0,0); vis[rest>0]=(0,160,0)
cv2.imwrite('walls_vis.png',cv2.resize(vis[800:2700,950:2650],None,fx=0.6,fy=0.6))
json.dump(rh+rv,open('rects.json','w'))
