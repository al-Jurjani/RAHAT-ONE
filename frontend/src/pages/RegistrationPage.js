import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Typography,
  TextField,
  Button,
  MenuItem,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { toast } from 'react-toastify';
import { lookupAPI, registrationAPI } from '../services/api';

const steps = ['Personal Information', 'Job Details', 'Upload Documents', 'Set Password'];

function RegistrationPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    personalEmail: '',
    name: '',
    cnicNumber: '',
    fatherName: '',
    dateOfBirth: '',
    phone: '',
    departmentId: '',
    jobPositionId: '',
    password: '',
    confirmPassword: ''
  });

  // Files
  const [files, setFiles] = useState({
    cnic: null,
    degree: null,
    medical: null
  });

  // Lookup data
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [allPositions, setAllPositions] = useState([]);
  const [workEmail, setWorkEmail] = useState('');

  // Load departments on mount
  useEffect(() => {
    loadDepartments();
  }, []);

  // Filter positions when department changes
  useEffect(() => {
    if (formData.departmentId && allPositions.length > 0) {
      const filtered = allPositions.filter(
        pos => pos.departmentId === parseInt(formData.departmentId)
      );
      setPositions(filtered);
    } else {
      setPositions([]);
    }
  }, [formData.departmentId, allPositions]);

  const loadDepartments = async () => {
    try {
      const deptResponse = await lookupAPI.getDepartments();
      setDepartments(deptResponse.data.data);

      const posResponse = await lookupAPI.getPositions();
      setAllPositions(posResponse.data.data);
    } catch (error) {
      toast.error('Failed to load departments');
      console.error(error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    setFiles(prev => ({ ...prev, [name]: fileList[0] }));
  };

  const handleNext = () => {
    // Validate current step
    if (activeStep === 0 && !validateStep1()) return;
    if (activeStep === 1 && !validateStep2()) return;
    if (activeStep === 2 && !validateStep3()) return;
    if (activeStep === 3 && !validateStep4()) return;

    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateStep1 = () => {
    if (!formData.personalEmail || !formData.name || !formData.cnicNumber ||
        !formData.fatherName || !formData.dateOfBirth || !formData.phone) {
      toast.error('Please fill all required fields');
      return false;
    }
    if (!/^\d{5}-\d{7}-\d{1}$/.test(formData.cnicNumber)) {
      toast.error('CNIC must be in format: 12345-1234567-1');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.departmentId || !formData.jobPositionId) {
      toast.error('Please select department and position');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!files.cnic) {
      toast.error('CNIC document is required');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (!formData.password || formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('personalEmail', formData.personalEmail);
      submitData.append('name', formData.name);
      submitData.append('cnicNumber', formData.cnicNumber);
      submitData.append('fatherName', formData.fatherName);
      submitData.append('dateOfBirth', formData.dateOfBirth);
      submitData.append('phone', formData.phone);
      submitData.append('departmentId', formData.departmentId);
      submitData.append('jobPositionId', formData.jobPositionId);
      submitData.append('password', formData.password);
      submitData.append('cnic', files.cnic);
      if (files.degree) submitData.append('degree', files.degree);
      if (files.medical) submitData.append('medical', files.medical);

      const response = await registrationAPI.complete(submitData);

      setWorkEmail(response.data.data.workEmail);
      toast.success('Registration completed successfully!');
      setActiveStep(steps.length); // Move to success screen

    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Personal Email"
                name="personalEmail"
                type="email"
                value={formData.personalEmail}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="CNIC Number"
                name="cnicNumber"
                placeholder="12345-1234567-1"
                value={formData.cnicNumber}
                onChange={handleInputChange}
                helperText="Format: 12345-1234567-1"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Father's Name"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Phone Number"
                name="phone"
                placeholder="+92-300-1234567"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                select
                label="Department"
                name="departmentId"
                value={formData.departmentId}
                onChange={handleInputChange}
              >
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                select
                label="Job Position"
                name="jobPositionId"
                value={formData.jobPositionId}
                onChange={handleInputChange}
                disabled={!formData.departmentId}
              >
                {positions.map(pos => (
                  <MenuItem key={pos.id} value={pos.id}>
                    {pos.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {formData.name && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Your work email will be: <strong>{formData.name.toLowerCase().replace(/\s+/g, '.').split('.').slice(0, 2).join('.')}@outfitters.com</strong>
                </Alert>
              </Grid>
            )}
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                CNIC Document (Required) *
              </Typography>
              <input
                type="file"
                name="cnic"
                accept="image/*"
                onChange={handleFileChange}
                style={{ marginBottom: 16 }}
              />
              {files.cnic && (
                <Typography variant="caption" color="success.main">
                  ✓ {files.cnic.name}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                Degree Certificate (Optional)
              </Typography>
              <input
                type="file"
                name="degree"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ marginBottom: 16 }}
              />
              {files.degree && (
                <Typography variant="caption" color="success.main">
                  ✓ {files.degree.name}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                Medical Certificate (Optional)
              </Typography>
              <input
                type="file"
                name="medical"
                accept=".pdf"
                onChange={handleFileChange}
              />
              {files.medical && (
                <Typography variant="caption" color="success.main">
                  ✓ {files.medical.name}
                </Typography>
              )}
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                helperText="Minimum 8 characters"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (activeStep === steps.length) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom color="success.main">
              ✓ Registration Successful!
            </Typography>
            <Typography variant="body1" paragraph>
              Your registration has been submitted successfully.
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Your work email: <strong>{workEmail}</strong>
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Your documents are being verified. You will receive an email once verification is complete.
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.href = '/status'}
              sx={{ mt: 3 }}
            >
              Check Status
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Employee Registration
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
          Complete all steps to register for onboarding
        </Typography>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : activeStep === steps.length - 1 ? (
                'Submit'
              ) : (
                'Next'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default RegistrationPage;
