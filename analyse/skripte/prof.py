import numpy as np,cv2,sys
im=cv2.imread('/root/.claude/uploads/3119549e-b240-5b00-9943-53178070c7de/32710f5f-image.png')
d=(im.max(axis=2)<130).astype(float)
O=(1020,867);S=117.8
def runs(a,thr):
    r=[];s=None
    for i,v in enumerate(a>thr):
        if v and s is None:s=i
        if not v and s is not None: r.append((s,i-1));s=None
    if s is not None:r.append((s,len(a)-1))
    return r
def ana(name,axis,lo,hi,a0,a1,thr=0.5,minlen=6):
    # axis 'z': band x in [lo,hi] px, scan y in a0..a1 ; axis 'x' : band y in [lo,hi], scan x
    if axis=='z': p=d[a0:a1,lo:hi].mean(axis=1); off=O[1]
    else: p=d[lo:hi,a0:a1].mean(axis=0); off=O[0]
    rr=[(round((a0+s-off)/S,3),round((a0+e+1-off)/S,3)) for s,e in runs(p,thr) if e-s>=minlen]
    print(name,rr)
# east structural wall x=12.565..12.74 => px
xe=lambda m:int(O[0]+m*S)
ana('east wall upper',  'z',xe(12.58),xe(12.72),900,2600)
ana('west wall','z',xe(0.23),xe(0.37),900,2600)
ana('north wall','x',int(O[1]+0.23*S),int(O[1]+0.37*S),1000,2560)
ana('south wall','x',int(O[1]+14.30*S),int(O[1]+14.43*S),1000,2560)
