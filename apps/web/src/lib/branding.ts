export const companyBrand = {
  name: "SO.TE.CO",
  subtitle: "Société Tunisienne des Etudes et Constructions",
  logoPath: "/brand/sotec-logo.png",
  markPath: "/brand/sotec-logo.png",
};

export function getBrandAssetUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export function getBrandLogoUrl() {
  return getBrandAssetUrl(companyBrand.logoPath);
}

export function getBrandMarkUrl() {
  return getBrandAssetUrl(companyBrand.markPath);
}
