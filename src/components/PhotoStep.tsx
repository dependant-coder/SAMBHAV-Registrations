// PhotoStep.tsx — Step 3 Photo upload, HEIC support, crop & compression per spec §8.3b
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

import { InfoBox } from './InfoBox';
import { StickyActions } from './StickyActions';
import {
  validateAndPreparePhoto,
  getCroppedImg,
  formatFileSize,
  type PixelCrop,
} from '../lib/photo';

import goodImg from '../assets/photo-rules/good.svg';
import shadesImg from '../assets/photo-rules/shades.svg';
import groupImg from '../assets/photo-rules/group.svg';
import darkImg from '../assets/photo-rules/dark.svg';

export interface PhotoStepProps {
  onNext: (blob: Blob, previewUrl: string) => void;
  onBack: () => void;
  existingBlob?: Blob | null;
  existingPreviewUrl?: string | null;
  hadDraftRestored?: boolean;
  fullName?: string;
  domainName?: string;
}

type StepMode = 'select' | 'processing' | 'crop' | 'ready';

export function PhotoStep({
  onNext,
  onBack,
  existingBlob = null,
  existingPreviewUrl = null,
  hadDraftRestored = false,
  fullName,
  domainName,
}: PhotoStepProps) {
  const [mode, setMode] = useState<StepMode>(existingBlob && existingPreviewUrl ? 'ready' : 'select');
  const [processingMsg, setProcessingMsg] = useState('Preparing your photo…');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Raw image for cropper
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Final cropped output
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(existingBlob);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingPreviewUrl);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const activeRawUrlRef = useRef<string | null>(null);
  const activePreviewUrlRef = useRef<string | null>(existingPreviewUrl);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (activeRawUrlRef.current) {
        URL.revokeObjectURL(activeRawUrlRef.current);
      }
    };
  }, []);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setMode('processing');
    setProcessingMsg('Preparing your photo…');

    try {
      const result = await validateAndPreparePhoto(file, (msg) => setProcessingMsg(msg));
      if (!result.ok || !result.objectUrl) {
        setMode(currentBlob ? 'ready' : 'select');
        setErrorMsg(result.message ?? "We couldn't process this photo. Please try another one.");
        return;
      }

      if (activeRawUrlRef.current) {
        URL.revokeObjectURL(activeRawUrlRef.current);
      }
      activeRawUrlRef.current = result.objectUrl;
      setRawImageSrc(result.objectUrl);

      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setMode('crop');
    } catch {
      setMode(currentBlob ? 'ready' : 'select');
      setErrorMsg("We couldn't read this photo. Please choose a JPG or PNG, or take a new photo.");
    }
  };

  const handleApplyCrop = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    setIsCropping(true);
    setErrorMsg(null);

    try {
      const blob = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation);

      const newPreview = URL.createObjectURL(blob);
      if (activePreviewUrlRef.current && activePreviewUrlRef.current !== existingPreviewUrl) {
        URL.revokeObjectURL(activePreviewUrlRef.current);
      }
      activePreviewUrlRef.current = newPreview;

      setCurrentBlob(blob);
      setPreviewUrl(newPreview);
      setMode('ready');
    } catch {
      setErrorMsg('Something went wrong while cropping. Please try again.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleCancelCrop = () => {
    if (activeRawUrlRef.current) {
      URL.revokeObjectURL(activeRawUrlRef.current);
      activeRawUrlRef.current = null;
    }
    setRawImageSrc(null);
    setMode(currentBlob ? 'ready' : 'select');
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleContinue = () => {
    if (!currentBlob || !previewUrl) {
      setErrorMsg('Please upload and crop your photo before continuing.');
      return;
    }
    onNext(currentBlob, previewUrl);
  };

  return (
    <section className="step" id="s3" aria-labelledby="s3-h">
      <p className="eyebrow">Step 3 of 4</p>
      <h2 className="h2" id="s3-h" tabIndex={-1}>
        Upload your photo
      </h2>
      <p className="desc">
        Your photo is printed on your Sambhav 4.0 team ID card. It must clearly show your face.
      </p>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-label="Take photo with camera"
        tabIndex={-1}
        onChange={handleFileSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose photo from gallery"
        tabIndex={-1}
        onChange={handleFileSelect}
      />

      {/* Draft notice if restored */}
      {hadDraftRestored && !currentBlob && mode === 'select' && (
        <InfoBox variant="info">
          Please add your photo again. Photos aren’t saved in drafts.
        </InfoBox>
      )}

      {/* Error notification */}
      {errorMsg && (
        <InfoBox variant="error">
          {errorMsg}
        </InfoBox>
      )}

      {/* ── MODE 1: Select / Upload ── */}
      {mode === 'select' && (
        <div id="p-select">
          <div className="rules">
            <div className="rule rule--do">
              <div className="rule__head">
                <span className="badge badge--do">✓ DO</span>
                <span className="rule__t">A clear ID photo</span>
              </div>
              <div className="rule__body">
                <div className="thumb thumb--frame" aria-hidden="true">
                  <img src={goodImg} alt="" />
                </div>
                <ul>
                  <li>Face clearly visible and front-facing</li>
                  <li>Good lighting on your face</li>
                  <li>Plain or simple background</li>
                  <li>Only you in the frame</li>
                </ul>
              </div>
            </div>

            <div className="rule rule--dont">
              <div className="rule__head">
                <span className="badge badge--dont">✕ DON’T</span>
                <span className="rule__t">Avoid these</span>
              </div>
              <div className="thumbs" aria-hidden="true">
                <div className="thumb">
                  <img src={shadesImg} alt="" />
                  <i className="thumb__x">
                    <svg className="ic"><use href="#i-x" /></svg>
                  </i>
                </div>
                <div className="thumb">
                  <img src={groupImg} alt="" />
                  <i className="thumb__x">
                    <svg className="ic"><use href="#i-x" /></svg>
                  </i>
                </div>
                <div className="thumb thumb--dim">
                  <img src={darkImg} alt="" />
                  <i className="thumb__x">
                    <svg className="ic"><use href="#i-x" /></svg>
                  </i>
                </div>
              </div>
              <ul>
                <li>Sunglasses, hats, or heavy beauty filters</li>
                <li>Group photos or cropped cut-outs</li>
                <li>Very dark, blurry, or low-res photos</li>
                <li>Photos of a physical printed photograph</li>
              </ul>
            </div>
          </div>

          <div className="photo-actions">
            <button
              type="button"
              className="btn btn--ink"
              onClick={() => cameraInputRef.current?.click()}
            >
              <svg className="ic" aria-hidden="true">
                <use href="#i-camera" />
              </svg>
              Take photo
            </button>
            <button
              type="button"
              className="btn btn--line"
              onClick={() => galleryInputRef.current?.click()}
            >
              <svg className="ic" aria-hidden="true">
                <use href="#i-image" />
              </svg>
              Choose from gallery
            </button>
          </div>
          <p className="fmt">
            JPG, PNG, WebP or iPhone HEIC · up to 15 MB · saved as a square 800×800 ID photo
          </p>
        </div>
      )}

      {/* ── MODE 2: Processing / Converting ── */}
      {mode === 'processing' && (
        <div className="proc" role="status">
          <div className="orbit" aria-hidden="true">
            <i />
            <i />
          </div>
          <p>{processingMsg}</p>
        </div>
      )}

      {/* ── MODE 3: Crop UI with react-easy-crop ── */}
      {mode === 'crop' && rawImageSrc && (
        <div id="p-crop">
          <p className="cropnote">
            Drag to center your face. Use the slider to zoom.
          </p>

          <div className="crop-wrapper" role="region" aria-label="Photo crop workspace">
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="rect"
              classes={{ cropAreaClassName: 'rg-cropArea' }}
              style={{
                cropAreaStyle: {
                  color: 'rgba(20,18,58,.62)',
                  border: '0',
                  borderRadius: 6,
                },
              }}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
            />
          </div>

          <div className="zoomrow">
            <svg className="ic" aria-hidden="true"><use href="#i-zoom-out" /></svg>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={zoom}
              aria-label="Zoom photo"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="slider"
            />
            <svg className="ic" aria-hidden="true"><use href="#i-zoom-in" /></svg>
          </div>

          <div className="toolrow">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleRotate}
            >
              <svg className="ic" aria-hidden="true"><use href="#i-rotate" /></svg>
              Rotate 90°
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setRotation(0);
              }}
            >
              <svg className="ic" aria-hidden="true"><use href="#i-reset" /></svg>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ── MODE 4: Photo Ready Preview (Circle & Square) ── */}
      {mode === 'ready' && currentBlob && previewUrl && (
        <div id="p-ready">
          <div className="readybar">
            <span className="vchip">
              <i>
                <svg className="ic"><use href="#i-check" /></svg>
              </i>
              Photo ready
            </span>
            <span className="meta">
              JPEG · 800×800 px · {formatFileSize(currentBlob.size)}
            </span>
          </div>

          <div className="previews">
            <figure className="pvbox pvbox--circle">
              <div className="pv">
                <img src={previewUrl} alt="Avatar preview" />
              </div>
              <figcaption>Avatar</figcaption>
            </figure>

            <figure className="pvbox">
              <div className="idc" aria-hidden="true">
                <div className="idc__top">
                  <span>Sambhav 4.0</span>
                  <span>Team</span>
                </div>
                <div className="idc__hole" />
                <div className="pv">
                  <img src={previewUrl} alt="" />
                </div>
                {fullName && <p className="idc__name">{fullName}</p>}
                {domainName && <p className="idc__dom">{domainName}</p>}
                <div className="idc__bar" />
              </div>
              <figcaption>ID card preview</figcaption>
            </figure>
          </div>

          <div className="readyacts">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => cameraInputRef.current?.click()}
            >
              <svg className="ic" aria-hidden="true"><use href="#i-camera" /></svg>
              Retake
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => galleryInputRef.current?.click()}
            >
              <svg className="ic" aria-hidden="true"><use href="#i-image" /></svg>
              Choose another
            </button>
            {rawImageSrc && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setMode('crop')}
              >
                <svg className="ic" aria-hidden="true"><use href="#i-scissors" /></svg>
                Adjust crop
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {mode === 'crop' ? (
        <StickyActions>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleCancelCrop}
            disabled={isCropping}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--blue btn--main"
            onClick={handleApplyCrop}
            disabled={isCropping}
          >
            {isCropping ? (
              <>
                <span className="spin" aria-hidden="true" />
                Processing…
              </>
            ) : (
              <>
                <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>
                Use this photo
              </>
            )}
          </button>
        </StickyActions>
      ) : (
        <StickyActions>
          <button
            type="button"
            onClick={onBack}
            className="btn btn--ghost"
            disabled={mode === 'processing' || isCropping}
          >
            <svg className="ic" aria-hidden="true"><use href="#i-arrow-l" /></svg>
            Back
          </button>
          <button
            type="button"
            className="btn btn--ink btn--main"
            onClick={handleContinue}
            disabled={!currentBlob || mode === 'processing' || isCropping}
          >
            Continue
            <svg className="ic" aria-hidden="true"><use href="#i-arrow-r" /></svg>
          </button>
        </StickyActions>
      )}
    </section>
  );
}
