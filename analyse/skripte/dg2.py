import numpy as np, cv2
O=(514,443);S=71.4
def m(px,py): return round((px-O[0])/S,2),round((py-O[1])/S,2)
for name in ('dg0','dg1'):
    im=cv2.imread(name+'_full.png'); b,g,r=[im[:,:,i].astype(int) for i in range(3)]
    blue=((b>200)&(r<190)&(g>190)&(b-r>40)).astype(np.uint8)
    blue=cv2.morphologyEx(blue,cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(blue,8)
    print(name,'windows')
    for i in range(1,n):
        if st[i,4]<1500: continue
        x,y,w,h,a=st[i]; print('  x%.2f..%.2f z%.2f..%.2f'%(m(x,y)[0],m(x+w,y)[0],m(x,y)[1],m(x,y+h)[1]),(w/S,h/S))
    gg=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
    dark=(gg<140).astype(np.float32)
    den=cv2.blur(dark,(41,41))
    white=(den<0.03).astype(np.uint8)
    white=cv2.morphologyEx(white,cv2.MORPH_OPEN,np.ones((21,21),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(white,8)
    seed=lab[int(O[1]+3*S), int(O[0]+8.2*S)]
    x,y,w,h,a=st[seed]
    print(name,'white',m(x,y),m(x+w,y+h),'area m2',a/S/S)
    cv2.imwrite(name+'_white.png',((lab==seed)*255).astype(np.uint8))
