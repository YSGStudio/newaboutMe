/**
 * 업로드 전에 사진을 줄이는 브라우저 전용 도우미.
 *
 * 요청 본문에는 플랫폼 한도가 있어서(Vercel 함수 4.5MB), 앱이 허용하는 용량과
 * 무관하게 그보다 큰 요청은 라우트에 닿기도 전에 413으로 끊긴다. 요즘 휴대폰
 * 사진은 한 장에 5~10MB가 나오는 일이 흔해서, 같은 화면에서 어떤 학생은 되고
 * 어떤 학생만 안 되는 상황이 생긴다.
 *
 * 그래서 사진은 올리기 전에 캔버스로 다시 그려 줄인다. PDF는 줄일 수 없으므로
 * 그대로 두고 용량 검사(lib/learning.ts)에 맡긴다.
 *
 * canvas·createImageBitmap을 쓰므로 **브라우저에서만** 부른다.
 */

/** 긴 변 기준 목표 크기. 교실에서 보는 용도라 이 정도면 충분하다. */
const MAX_EDGE = 1600;

/** 화질을 낮춰 가며 시도하는 순서. 앞에서 목표 용량을 맞추면 거기서 멈춘다. */
const QUALITY_STEPS = [0.85, 0.7, 0.55];

const isShrinkableImage = (type: string) =>
  type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';

/** 확장자를 .jpg로 바꾼 이름 — 줄인 결과는 항상 JPEG다. */
const toJpegName = (name: string) => `${name.replace(/\.[^./\\]+$/, '')}.jpg`;

/**
 * 사진이 목표 용량보다 크면 줄여서 새 File을 돌려준다.
 * 줄일 수 없는 형식이거나 이미 작으면, 또는 중간에 실패하면 원본을 그대로 돌려준다
 * (줄이기는 어디까지나 보조 수단이고, 최종 판정은 용량 검사가 한다).
 *
 * @param targetBytes 이 용량 아래로 맞추는 것을 목표로 한다
 */
export async function shrinkImageForUpload(file: File, targetBytes: number): Promise<File> {
  if (!isShrinkableImage(file.type) || file.size <= targetBytes) return file;

  try {
    // EXIF 회전 정보를 반영해서 읽는다. 안 그러면 세로 사진이 눕는다.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // PNG 투명 배경이 검게 나오지 않도록 흰색을 먼저 깐다.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let best: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      );
      if (!blob) break;
      best = blob;
      if (blob.size <= targetBytes) break;
    }

    // 줄인 결과가 원본보다 크면(이미 잘 압축된 사진) 원본을 쓴다.
    if (!best || best.size >= file.size) return file;

    return new File([best], toJpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
