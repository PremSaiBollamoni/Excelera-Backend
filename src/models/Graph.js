import mongoose from 'mongoose';

const graphSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExcelFile',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['2d', '3d']
  },
  chartType: {
    type: String,
    required: true,
    enum: ['bar', 'line', 'pie', 'scatter', 'area', 'radar', '3d-column']
  },
  xAxis: {
    type: String,
    required: true
  },
  yAxis: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  config: {
    type: Object,
    required: true
  },
  sheetName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
graphSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add indexes for better query performance
graphSchema.index({ user: 1, createdAt: -1 });
graphSchema.index({ isPublic: 1, createdAt: -1 });
graphSchema.index({ tags: 1 });

const Graph = mongoose.model('Graph', graphSchema);

export default Graph; 