export type Lang = 'en' | 'hi' | 'te';
export type Severity = 'mild' | 'moderate' | 'severe';
export interface Report {
  preview: boolean;        // true => synthetic content for UI preview only, never a real diagnosis
  healthy: boolean;
  lowConfidence: boolean;
  crop: string;
  title: string;           // disease name (or localized "Healthy" is applied in the panel)
  confidence: number | null;
  severity: Severity | null; // only set when the API supplies it; the classifier does not estimate severity
  description: string; care: string[]; fertilizer: string[]; treatments: string[];
  advice: string;
  raw: unknown;
}

type K = { re: RegExp; description: string; care: string[]; fertilizer: string[]; treatments: string[] };
// General, label-agnostic reference notes. No product names or dosages: those depend on country, crop stage and
// registered-product labels, so they are deliberately left to a local extension service.
const KB: K[] = [
  { re: /early[_ ]blight/i, description: 'A fungal disease (Alternaria) that causes dark spots with concentric rings, usually starting on older leaves, often with yellowing around the lesions.',
    care: ['Remove and dispose of heavily spotted lower leaves.', 'Water at the base and avoid wetting foliage.', 'Rotate crops and clear plant debris after harvest.'],
    fertilizer: ['Keep nutrition balanced; stressed, nutrient-poor plants are more susceptible.', 'Base any fertilizer plan on a soil test.'], treatments: ['If spread continues, ask your extension service about a locally registered protectant fungicide and follow the label.'] },
  { re: /late[_ ]blight/i, description: 'An oomycete disease (Phytophthora infestans) causing water-soaked, fast-spreading lesions in cool, wet weather. It can destroy a crop within days.',
    care: ['Act quickly: remove and bag affected plants; do not compost them.', 'Improve airflow and avoid overhead irrigation.', 'Check neighbouring plants daily in humid weather.'],
    fertilizer: ['Avoid excess nitrogen, which encourages soft, susceptible growth.'], treatments: ['Contact a local extension service promptly for locally effective, registered options.'] },
  { re: /bacterial[_ ]spot/i, description: 'A bacterial disease (Xanthomonas) causing small dark, water-soaked spots that may have yellow halos. It spreads by splashing water and contaminated tools.',
    care: ['Avoid working among wet plants.', 'Disinfect tools; use clean seed and transplants.', 'Remove badly affected leaves.'],
    fertilizer: ['Balanced nutrition; avoid heavy nitrogen.'], treatments: ['Fungicides do not cure bacterial disease; ask local advisers whether a registered copper-based product is appropriate.'] },
  { re: /leaf[_ ]mold/i, description: 'A fungal disease favoured by high humidity: pale yellow patches on the upper leaf surface with olive-grey mould underneath.',
    care: ['Lower humidity: ventilate and space plants.', 'Water in the morning at the base.', 'Remove affected leaves.'],
    fertilizer: ['Balanced feeding; avoid dense, over-fertilized canopy.'], treatments: ['Consult local guidance on registered fungicides if humidity cannot be reduced.'] },
  { re: /septoria/i, description: 'A fungal leaf-spot disease with many small round spots that have dark borders and pale centres, typically beginning on lower leaves.',
    care: ['Remove infected lower leaves.', 'Mulch to limit soil splash.', 'Rotate crops.'],
    fertilizer: ['Maintain even, balanced nutrition based on soil testing.'], treatments: ['Ask your extension service about locally registered protectant fungicides.'] },
  { re: /powdery[_ ]mildew/i, description: 'A fungal disease showing white powdery growth on leaf surfaces. It thrives in warm days, cool nights and crowded plantings.',
    care: ['Improve airflow and sunlight penetration.', 'Remove heavily infected leaves.', 'Avoid overcrowding.'],
    fertilizer: ['Avoid excess nitrogen.'], treatments: ['Locally registered fungicides or approved biological options may help; follow the label.'] },
  { re: /rust/i, description: 'A fungal disease producing orange-brown pustules, mostly on the underside of leaves, that release powdery spores.',
    care: ['Remove infected leaves early.', 'Avoid wetting foliage.', 'Monitor nearby plants.'],
    fertilizer: ['Balanced nutrition; avoid heavy nitrogen.'], treatments: ['Ask your extension service which registered fungicides suit your crop.'] },
  { re: /mosaic|curl|virus/i, description: 'A viral disease causing mottled, curled or distorted leaves and stunting. Many viruses are carried by insects such as aphids or whiteflies.',
    care: ['Remove and destroy infected plants to protect healthy ones.', 'Control insect vectors and weeds.', 'Wash hands and disinfect tools.'],
    fertilizer: ['Good nutrition supports vigour but cannot cure the virus.'], treatments: ['There is no curative treatment for plant viruses; focus on prevention and vector control.'] },
  { re: /spider[_ ]mite/i, description: 'Tiny sap-feeding pests that cause fine stippling, bronzing and sometimes webbing, especially in hot, dry conditions.',
    care: ['Check leaf undersides with a hand lens.', 'Rinse plants and reduce dust and drought stress.', 'Conserve natural predators.'],
    fertilizer: ['Avoid over-fertilizing with nitrogen.'], treatments: ['Ask local advisers about registered miticides or biological controls.'] },
  { re: /target[_ ]spot/i, description: 'A fungal disease with brown lesions that often show concentric rings, favoured by warm, humid conditions.',
    care: ['Remove infected leaves.', 'Improve airflow and avoid overhead watering.', 'Rotate crops.'],
    fertilizer: ['Balanced nutrition based on soil testing.'], treatments: ['Ask your extension service about locally registered fungicides.'] },
];
const FALLBACK: Omit<K, 're'> = {
  description: 'The model detected symptoms consistent with this condition. A single image cannot confirm the cause, so treat this as decision support.',
  care: ['Photograph several leaves, both sides, in good light.', 'Isolate or remove severely affected material when appropriate.', 'Avoid wetting foliage and improve airflow.'],
  fertilizer: ['Use balanced nutrition guided by a soil test; avoid heavy nitrogen on stressed plants.'], treatments: ['Confirm the cause locally before applying any product, and follow registered product labels and regulations.'],
};
const HEALTHY: Omit<K, 're'> = {
  description: 'No disease pattern was detected in this image. One photo cannot rule out every pest or disorder, so keep monitoring.',
  care: ['Keep watering consistent, at the base of the plant.', 'Maintain airflow and remove dead leaves.', 'Re-check leaves weekly, including undersides.'],
  fertilizer: ['Use a balanced fertilizer based on soil test results and the crop stage.'], treatments: ['No treatment indicated.'],
};

const nice = (s: string) => s.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
const SEV = new Set(['mild', 'moderate', 'severe']);

/** Map the real /api/v1/predict response to what the panel shows. Nothing here invents a prediction. */
export function buildReport(api: any): Report {
  const cls: string = String(api?.diagnosis?.predicted_class ?? 'Unknown');
  const [cropRaw, condRaw] = cls.includes('___') ? cls.split('___') : ['', cls];
  const healthy = /healthy/i.test(cls);
  const kb = healthy ? HEALTHY : KB.find((k) => k.re.test(cls)) ?? FALLBACK;
  const sev = api?.diagnosis?.severity ?? api?.severity;
  const confidence = typeof api?.diagnosis?.confidence === 'number' ? api.diagnosis.confidence : null;
  return {
    preview: false, healthy, lowConfidence: api?.advice?.status === 'uncertain' || (confidence !== null && confidence < 0.65),
    crop: nice(cropRaw), title: healthy ? '' : nice(condRaw), confidence, severity: !healthy && SEV.has(sev) ? sev : null,
    description: kb.description, care: kb.care, fertilizer: kb.fertilizer, treatments: kb.treatments, advice: String(api?.advice?.message ?? ''), raw: api,
  };
}

/** PLACEHOLDERS for UI preview only (dev / ?preview=1). Clearly flagged in the panel; never saved or reported as a diagnosis. */
export function previewReport(kind: 'healthy' | 'diseased'): Report {
  const base = kind === 'healthy' ? HEALTHY : FALLBACK;
  return { preview: true, healthy: kind === 'healthy', lowConfidence: false, crop: 'Sample', title: kind === 'healthy' ? '' : 'Sample leaf spot', confidence: null, severity: kind === 'healthy' ? null : 'moderate', ...base, advice: '', raw: null };
}
