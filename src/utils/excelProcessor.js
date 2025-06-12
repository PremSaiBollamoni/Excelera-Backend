import xlsx from 'xlsx';

export const processExcelFile = (buffer) => {
  try {
    // Read the Excel file
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    // Get all sheet names
    const sheetNames = workbook.SheetNames;
    
    // Process each sheet
    const processedData = sheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = xlsx.utils.sheet_to_json(worksheet);
      
      // Get column headers
      const headers = Object.keys(jsonData[0] || {});
      
      // Get data types for each column
      const columnTypes = headers.reduce((acc, header) => {
        const sampleValue = jsonData[0]?.[header];
        acc[header] = typeof sampleValue;
        return acc;
      }, {});

      return {
        sheetName,
        headers,
        columnTypes,
        data: jsonData,
        rowCount: jsonData.length,
        columnCount: headers.length
      };
    });

    return {
      success: true,
      data: processedData,
      totalSheets: sheetNames.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const validateExcelData = (data) => {
  const validations = {
    hasData: data.length > 0,
    hasHeaders: Object.keys(data[0] || {}).length > 0,
    isConsistent: true
  };

  if (data.length > 1) {
    const firstRowKeys = Object.keys(data[0]);
    validations.isConsistent = data.every(row => 
      Object.keys(row).length === firstRowKeys.length
    );
  }

  return validations;
};

export const getColumnStatistics = (data, columnName) => {
  const values = data.map(row => row[columnName]).filter(val => val !== undefined);
  
  if (values.length === 0) return null;

  const isNumeric = values.every(val => !isNaN(val));
  
  if (isNumeric) {
    const numbers = values.map(Number);
    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
      sum: numbers.reduce((a, b) => a + b, 0),
      count: numbers.length
    };
  } else {
    return {
      uniqueValues: [...new Set(values)],
      count: values.length,
      type: 'categorical'
    };
  }
}; 