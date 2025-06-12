import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import Graph from '../models/Graph.js';
import ExcelFile from '../models/ExcelFile.js';
import { processExcelFile, validateExcelData, getColumnStatistics } from '../utils/excelProcessor.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload and process Excel file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const result = processExcelFile(req.file.buffer);
    
    if (!result.success) {
      return res.status(400).json({ message: 'Error processing file', error: result.error });
    }

    // Save the processed Excel data to MongoDB
    const newExcelFile = new ExcelFile({
      user: req.user.userId,
      fileName: req.file.originalname,
      sheets: result.data, // Contains sheetName, headers, columnTypes, data, rowCount, columnCount
      uploadDate: new Date(),
      // validations and statistics are returned to frontend but not stored if not needed
    });

    await newExcelFile.save();

    // Validate the data (still return to frontend)
    const validations = result.data.map(sheet => ({
      sheetName: sheet.sheetName,
      ...validateExcelData(sheet.data)
    }));

    // Get statistics for each column in each sheet (still return to frontend)
    const statistics = result.data.map(sheet => ({
      sheetName: sheet.sheetName,
      columns: sheet.headers.reduce((acc, header) => {
        acc[header] = getColumnStatistics(sheet.data, header);
        return acc;
      }, {})
    }));

    res.json({
      _id: newExcelFile._id, // Return the MongoDB ID of the saved ExcelFile
      fileName: newExcelFile.fileName,
      uploadDate: newExcelFile.uploadDate,
      userId: newExcelFile.user,
      sheets: result.data,
      validations,
      statistics,
      totalSheets: result.totalSheets
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing file', error: error.message });
  }
});

// Get all user's uploaded Excel files
router.get('/files', auth, async (req, res) => {
  try {
    const files = await ExcelFile.find({ user: req.user.userId }).sort({ uploadDate: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
});

// Get a specific uploaded Excel file by ID
router.get('/files/:id', auth, async (req, res) => {
  try {
    const file = await ExcelFile.findOne({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.json(file);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching file', error: error.message });
  }
});

// Delete an uploaded Excel file
router.delete('/files/:id', auth, async (req, res) => {
  try {
    const file = await ExcelFile.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Also delete any graphs associated with this file
    await Graph.deleteMany({ fileId: file._id });

    res.json({ message: 'File and associated graphs deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting file', error: error.message });
  }
});

// Save graph configuration
router.post('/save-graph', auth, async (req, res) => {
  try {
    const { title, type, chartType, data, config, sheetName, fileId, xAxis, yAxis } = req.body;
    console.log('Received save graph request:', { title, type, chartType, sheetName, fileId, xAxis, yAxis });
    
    // Validate required fields
    if (!title || !type || !data || !config || !sheetName || !fileId || !xAxis || !yAxis) {
      console.log('Missing required fields:', {
        hasTitle: !!title,
        hasType: !!type,
        hasData: !!data,
        hasConfig: !!config,
        hasSheetName: !!sheetName,
        hasFileId: !!fileId,
        hasXAxis: !!xAxis,
        hasYAxis: !!yAxis
      });
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['title', 'type', 'data', 'config', 'sheetName', 'fileId', 'xAxis', 'yAxis'],
        received: { title, type, chartType, sheetName, fileId, xAxis, yAxis }
      });
    }

    // Validate that fileId exists and belongs to the user
    const associatedFile = await ExcelFile.findOne({ _id: fileId, user: req.user.userId });
    console.log('Found associated file:', associatedFile?._id);
    if (!associatedFile) {
      console.log('File not found or not owned by user:', fileId);
      return res.status(400).json({ 
        message: 'Associated Excel file not found or not owned by user.' 
      });
    }

    const graph = new Graph({
      user: req.user.userId,
      fileId,
      title,
      type,
      chartType,
      data,
      config,
      sheetName,
      xAxis,
      yAxis
    });

    console.log('Saving graph:', graph);
    await graph.save();
    console.log('Graph saved successfully with id:', graph._id);

    res.status(201).json(graph);
  } catch (error) {
    console.error('Error saving graph:', error);
    res.status(500).json({ 
      message: 'Error saving graph', 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Get user's graphs
router.get('/graphs', auth, async (req, res) => {
  try {
    console.log('Fetching graphs for user:', req.user.userId);
    const graphs = await Graph.find({ user: req.user.userId })
      .select('-data') // Exclude the actual data from the response to keep it light
      .populate('fileId', 'fileName uploadDate') // Populate file details
      .sort({ createdAt: -1 });

    console.log('Found graphs:', graphs.length);
    
    // Transform the response to include fileName
    const transformedGraphs = graphs.map(graph => {
      const transformed = {
        ...graph.toObject(),
        fileName: graph.fileId?.fileName
      };
      console.log('Transformed graph:', {
        id: transformed._id,
        fileId: transformed.fileId,
        fileName: transformed.fileName
      });
      return transformed;
    });

    res.json(transformedGraphs);
  } catch (error) {
    console.error('Error fetching graphs:', error);
    res.status(500).json({ message: 'Error fetching graphs', error: error.message });
  }
});

// Update Get specific graph to include file details
router.get('/graphs/:id', auth, async (req, res) => {
  try {
    const graph = await Graph.findOne({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!graph) {
      return res.status(404).json({ message: 'Graph not found' });
    }

    // Get the associated Excel file
    const file = await ExcelFile.findById(graph.fileId);
    if (!file) {
      return res.status(404).json({ message: 'Associated Excel file not found' });
    }

    // Find the correct sheet and its data
    const sheetData = file.sheets.find(sheet => sheet.sheetName === graph.sheetName);
    if (!sheetData) {
      return res.status(404).json({ message: 'Sheet not found in Excel file' });
    }

    // Return the graph with the sheet data
    const graphWithData = {
      ...graph.toObject(),
      data: sheetData.data,
      fileName: file.fileName
    };

    res.json(graphWithData);
  } catch (error) {
    console.error('Error fetching graph:', error);
    res.status(500).json({ message: 'Error fetching graph', error: error.message });
  }
});

// Delete graph - already linked to fileId, no change needed
router.delete('/graphs/:id', auth, async (req, res) => {
  try {
    const graph = await Graph.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!graph) {
      return res.status(404).json({ message: 'Graph not found' });
    }

    res.json({ message: 'Graph deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting graph', error: error.message });
  }
});

export default router; 