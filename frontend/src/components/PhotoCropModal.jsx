import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X } from 'lucide-react';
import { Button } from './ui/button';

// Crop area to canvas blob
async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

export default function PhotoCropModal({ imageSrc, onCropDone, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      await onCropDone(blob);
    } finally {
      setSaving(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/90">
      {/* Close */}
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Header */}
      <div className="text-center mb-4 px-4">
        <h3 className="text-lg font-bold text-white font-['Outfit']">Crop your photo</h3>
        <p className="text-sm text-gray-400">Drag and zoom to fit a vertical frame (3:4)</p>
      </div>

      {/* Cropper */}
      <div className="relative w-full max-w-md aspect-[3/4] mx-4">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={3 / 4}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          cropShape="rect"
          showGrid={false}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 mt-4 px-8 w-full max-w-md">
        <span className="text-xs text-gray-400">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 px-8 w-full max-w-md">
        <Button
          variant="outline"
          className="flex-1 h-12 rounded-xl border-gray-700 text-gray-300"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Use Photo'
          )}
        </Button>
      </div>
    </div>
  );
}
