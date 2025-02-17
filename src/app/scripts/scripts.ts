const fs = require('fs');
const path = require('path');

const removeAllTopics = () => {
  try {
    // Read the JSON file
    const filePath = path.join(
      process.cwd(),
      'analysis-results',
      'email-analysis-rheinbahn-2025-02-12T11-41-22-824Z.json'
    );
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Remove allTopics from each analysis entry
    if (jsonData.analysis && Array.isArray(jsonData.analysis)) {
      jsonData.analysis = jsonData.analysis.map(
        ({
          allTopics,
          ...rest
        }: {
          allTopics?: string[];
          [key: string]: any;
        }) => rest
      );
    }

    // Write the modified JSON back to file
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    console.log(
      'Successfully removed allTopics property from analysis entries'
    );
  } catch (error) {
    console.error('Error processing JSON file:', error);
  }
};

removeAllTopics();
