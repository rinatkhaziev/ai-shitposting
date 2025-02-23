# Audio Analysis

## Frequency Analyzer

The `FrequencyAnalyzer` class provides robust pitch detection with the following features:

- Noise reduction using a noise floor threshold (-60 dB)
- Frequency smoothing for vibrato handling (5-sample buffer)
- Dominant frequency detection
- Minimum frequency threshold (20 Hz)

### Usage

```typescript
const analyzer = new FrequencyAnalyzer();
const pitch = analyzer.analyzePitch(audioData, sampleRate);
```

The analyzer will return `null` for any input below the noise floor or minimum frequency threshold.
