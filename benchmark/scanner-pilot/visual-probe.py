"""Frozen, offline ORB/RANSAC candidate-retrieval experiment. Never approves import.

The retrieval function receives pixels and TCG only; expected identifiers are not
inputs. A fixed external index supplies candidate labels after geometric matching.
Usage: PYTHONPATH=... python visual-probe.py INDEX MANIFEST PHOTOS OUTPUT SPLIT
"""
import hashlib, json, sys, time
from pathlib import Path
import cv2 as cv
import numpy as np

PARAMETERS = dict(width=800, features=2500, ratio=.75, ransac_px=4., min_inliers=16,
                  min_inlier_fraction=.5, min_coverage=.10, seed=160012)
cv.setNumThreads(1)
cv.setRNGSeed(PARAMETERS['seed'])
ORB = cv.ORB_create(nfeatures=PARAMETERS['features'], fastThreshold=12)
MATCHER = cv.BFMatcher(cv.NORM_HAMMING)

def features(file, tcg, reference=False):
    original = cv.imread(str(file), cv.IMREAD_GRAYSCALE)
    if original is None:
        raise ValueError('Unreadable image: '+str(file))
    h,w = original.shape
    image = cv.resize(original,(PARAMETERS['width'],round(h*PARAMETERS['width']/w)))
    mask = None
    if reference:
        h,w = image.shape
        mask = np.zeros_like(image)
        y0,y1 = (.12,.64) if tcg=='pokemon' else (.08,.72)
        mask[round(h*y0):round(h*y1),round(w*.06):round(w*.94)] = 255
    points,descriptors = ORB.detectAndCompute(image,mask)
    return image,points,descriptors

def retrieve(query, tcg, references):
    qi,qk,qd = query
    if qd is None:
        return []
    rows=[]
    for metadata,(ri,rk,rd) in references:
        if metadata['tcg']!=tcg or rd is None:
            continue
        pairs=MATCHER.knnMatch(rd,qd,k=2)
        good=[p[0] for p in pairs if len(p)==2 and p[0].distance<PARAMETERS['ratio']*p[1].distance]
        if len(good)<8:
            continue
        source=np.float32([rk[m.queryIdx].pt for m in good]).reshape(-1,1,2)
        dest=np.float32([qk[m.trainIdx].pt for m in good]).reshape(-1,1,2)
        matrix,mask=cv.findHomography(source,dest,cv.RANSAC,PARAMETERS['ransac_px'])
        if matrix is None or mask is None:
            continue
        keep=mask.ravel().astype(bool);count=int(keep.sum());fraction=count/len(good)
        if count<4:
            continue
        hull=cv.convexHull(source[keep]);coverage=float(cv.contourArea(hull)/(ri.shape[0]*ri.shape[1]))
        h,w=ri.shape
        corners=np.float32([[0,0],[w,0],[w,h],[0,h]]).reshape(-1,1,2)
        quad=cv.perspectiveTransform(corners,matrix).reshape(-1,2)
        area=float(abs(cv.contourArea(quad))/(qi.shape[0]*qi.shape[1]))
        valid=bool(np.isfinite(quad).all() and cv.isContourConvex(quad) and .1<area<1.05)
        supported=bool(valid and count>=PARAMETERS['min_inliers'] and fraction>=PARAMETERS['min_inlier_fraction'] and coverage>=PARAMETERS['min_coverage'])
        rows.append({**{k:metadata[k] for k in ['id','tcg','code','language']},'inliers':count,'matches':len(good),'inlierFraction':round(fraction,3),'coverage':round(coverage,3),'geometricCandidate':supported,'quad':quad.tolist(),'ready':False})
    return sorted(rows,key=lambda r:(r['geometricCandidate'],r['inliers'],r['coverage']),reverse=True)

def main():
    index_file,manifest_file,photos,output,split=sys.argv[1:]
    index_bytes=Path(index_file).read_bytes();index=json.loads(index_bytes)
    refs=[]
    for meta in index['references']:
        if hashlib.sha256(Path(meta['file']).read_bytes()).hexdigest()!=meta['sha256']:
            raise ValueError('Reference changed after freeze: '+meta['id'])
        refs.append((meta,features(meta['file'],meta['tcg'],True)))
    manifest=json.loads(Path(manifest_file).read_text());results=[]
    for card in manifest['cards']:
        if card['split']!=split:continue
        for shot in card['shots']:
            start=time.perf_counter()
            found=retrieve(features(Path(photos)/shot['file'],card['tcg']),card['tcg'],refs)
            row={'caseId':shot['id'],'inputSha256':shot['sha256'],'tcg':card['tcg'],'ranked':found[:8],'elapsedNativeMs':round((time.perf_counter()-start)*1000),'ready':False}
            results.append(row)
            print(json.dumps({'caseId':shot['id'],'candidates':found[:2]},ensure_ascii=False))
    report={'method':'ORB/RANSAC candidate retrieval; no OCR, no automatic confidence/import','opencv':cv.__version__,'parameters':PARAMETERS,'indexSha256':hashlib.sha256(index_bytes).hexdigest(),'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'split':split,'referenceCount':len(refs),'results':results}
    Path(output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
