"""Train MobileNetV2 on a folder-per-class image dataset.
Expected: data/class_name/image.jpg. Weights are never downloaded implicitly.
"""
import argparse, json, random
from pathlib import Path
import torch
from torch import nn
from torch.utils.data import DataLoader, random_split, Subset
from torchvision import datasets, models, transforms

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--data',required=True);p.add_argument('--output',default='models/plantguard_mobilenetv2.pt')
    p.add_argument('--epochs',type=int,default=10);p.add_argument('--batch-size',type=int,default=32);p.add_argument('--lr',type=float,default=1e-3);p.add_argument('--seed',type=int,default=42)
    a=p.parse_args(); random.seed(a.seed);torch.manual_seed(a.seed)
    root=Path(a.data)
    train_tf=transforms.Compose([transforms.Resize((224,224)),transforms.RandomHorizontalFlip(),transforms.RandomRotation(12),transforms.ColorJitter(brightness=.15,contrast=.15,saturation=.1),transforms.ToTensor(),transforms.Normalize([.485,.456,.406],[.229,.224,.225])])
    eval_tf=transforms.Compose([transforms.Resize((224,224)),transforms.ToTensor(),transforms.Normalize([.485,.456,.406],[.229,.224,.225])])
    base=datasets.ImageFolder(root,transform=train_tf)
    if len(base.classes)<2 or len(base)<10: raise SystemExit('Need at least 2 class folders and 10 valid images.')
    n=len(base); ntrain=max(1,int(n*.8)); nval=n-ntrain
    if nval<1: raise SystemExit('Need enough images to make a validation split.')
    train_set,val_set=random_split(base,[ntrain,nval],generator=torch.Generator().manual_seed(a.seed))
    val_set.dataset=datasets.ImageFolder(root,transform=eval_tf)
    train=DataLoader(train_set,batch_size=a.batch_size,shuffle=True,num_workers=0);val=DataLoader(val_set,batch_size=a.batch_size,shuffle=False,num_workers=0)
    model=models.mobilenet_v2(weights=None);model.classifier[1]=nn.Linear(model.last_channel,len(base.classes))
    device='cuda' if torch.cuda.is_available() else 'cpu';model.to(device);opt=torch.optim.AdamW(model.parameters(),lr=a.lr);loss_fn=nn.CrossEntropyLoss()
    for epoch in range(a.epochs):
        model.train();total=correct=seen=0
        for x,y in train:
            x,y=x.to(device),y.to(device);opt.zero_grad();out=model(x);loss=loss_fn(out,y);loss.backward();opt.step()
            total+=loss.item()*len(y);correct+=(out.argmax(1)==y).sum().item();seen+=len(y)
        model.eval();vcorrect=vseen=0
        with torch.inference_mode():
            for x,y in val:
                x,y=x.to(device),y.to(device);vcorrect+=(model(x).argmax(1)==y).sum().item();vseen+=len(y)
        print(f'epoch={epoch+1}/{a.epochs} train_loss={total/max(seen,1):.4f} train_acc={correct/max(seen,1):.3f} val_acc={vcorrect/max(vseen,1):.3f}')
    out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
    torch.save({'state_dict':model.cpu().state_dict(),'classes':base.classes,'version':'mobilenetv2-custom-v1','input_size':224,'normalization':{'mean':[.485,.456,.406],'std':[.229,.224,.225]},'seed':a.seed,'dataset_size':n,'validation_fraction':nval/n},out)
    print(f'Saved checkpoint to {out}. Reported validation metrics are from this run only; test on a separate held-out set before making accuracy claims.')
if __name__=='__main__': main()
