export function deAnonymizeText(
  text: string,
  replacements: Record<string, Array<Record<string, string>>>,
  nachname: string
) {
  let deanonymizedText = text;

  const replacementsWithNamePlaceholder: Record<
    string,
    Array<Record<string, string>>
  > = {
    ...replacements,
    names: [...replacements.names, { '[NAMEPLACEHOLDER]': nachname }],
  };
  // Iterate through each category in replacements
  for (const category in replacementsWithNamePlaceholder) {
    for (const replacementObj of replacementsWithNamePlaceholder[category]) {
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
