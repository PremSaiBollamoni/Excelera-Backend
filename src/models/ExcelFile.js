import mongoose from 'mongoose';

const sheetDataSchema = new mongoose.Schema({
  sheetName: { type: String, required: true },
  headers: [{ type: String }],
  columnTypes: { type: Object }, // Flexible schema for column types
  data: { type: Array }, // Store the actual JSON rows as an array
  rowCount: { type: Number },
  columnCount: { type: Number },
});

const excelFileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  // Store an array of processed sheets
  sheets: [sheetDataSchema],
  // Optionally store validations and statistics if needed for backend logic later
  // validations: { type: Array }, 
  // statistics: { type: Array },
});

const ExcelFile = mongoose.model('ExcelFile', excelFileSchema);

export default ExcelFile; 