export function deAnonymizeText(
  text: string,
  replacements: Record<string, string>
) {
  let deanonymizedText = text;

  // Iterate through each category in replacements
  for (const category in replacements) {
    for (const replacementObj of replacements[category]) {
      for (const [placeholder, value] of Object.entries(replacementObj)) {
        deanonymizedText = deanonymizedText.replace(placeholder, value);
      }
    }
  }

  return deanonymizedText;
}

export function getPlaceholderKeys(replacements: Record<string, any>) {
  const placeholders: string[] = [];

  // Iterate through each category in replacements
  for (const category in replacements) {
    // Get array for this category
    const replacementsArray = replacements[category];
    // For each object in the array, get its keys (placeholders)
    replacementsArray.forEach((obj: Record<string, any>) => {
      placeholders.push(...Object.keys(obj));
    });
  }

  return placeholders;
}
