import numpy as np, cv2
im=cv2.imread('/root/.claude/uploads/3119549e-b240-5b00-9943-53178070c7de/32710f5f-image.png')
g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
# exclude red text: red has high R, low G/B -> gray moderate; use min channel? black: all low
b,gg,r=cv2.split(im)
dark=((r<120)&(gg<120)&(b<120)).astype(np.uint8)
# fill hatch
cl=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
op=cv2.morphologyEx(cl,cv2.MORPH_OPEN,np.ones((17,17),np.uint8))  # remove lines <17px (0.14m)
cv2.imwrite('mask.png',op*255)
ys,xs=np.where(op>0); print(xs.min(),xs.max(),ys.min(),ys.max())
vis=im.copy(); vis[op>0]=(0,0,255)
cv2.imwrite('mask_vis.png',cv2.resize(vis,(1170,1157)))
