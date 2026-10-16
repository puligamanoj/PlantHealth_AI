import argparse
import torch
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms
from torch import nn
def main():
 p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--weights',required=True);p.add_argument('--batch-size',type=int,default=32);a=p.parse_args()
 ck=torch.load(a.weights,map_location='cpu',weights_only=False);classes=ck['classes']
 tf=transforms.Compose([transforms.Resize((224,224)),transforms.ToTensor(),transforms.Normalize([.485,.456,.406],[.229,.224,.225])])
 ds=datasets.ImageFolder(a.data,transform=tf)
 if ds.classes!=classes: raise SystemExit(f'Class order mismatch: dataset={ds.classes}; checkpoint={classes}')
 model=models.mobilenet_v2(weights=None);model.classifier[1]=nn.Linear(model.last_channel,len(classes));model.load_state_dict(ck['state_dict']);model.eval()
 loader=DataLoader(ds,batch_size=a.batch_size,shuffle=False);correct=total=0
 with torch.inference_mode():
  for x,y in loader: correct+=(model(x).argmax(1)==y).sum().item();total+=len(y)
 print(f'evaluated_images={total} accuracy={correct/max(total,1):.4f}')
 print('NOTE: Evaluating on training data is not a valid generalization estimate. Supply a held-out test directory for a meaningful test score.')
if __name__=='__main__':main()
