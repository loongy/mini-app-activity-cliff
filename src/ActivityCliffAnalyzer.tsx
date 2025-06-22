import React, { useState, useMemo, useEffect } from 'react';
import { Upload, AlertCircle, TrendingUp, TrendingDown, ChevronDown, Loader2 } from 'lucide-react';
import Papa from 'papaparse';

interface Compound {
    smiles: string;
    activity: number;
    id: string;
}

interface MatchedPair {
    compound1: Compound;
    compound2: Compound;
    similarity: number;
    activityDiff: number;
    cliffScore: number;
}

// Styles
const styles = {
    app: {
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: "'Courier New', Courier, monospace",
        padding: '32px'
    },
    container: {
        maxWidth: '1200px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
    },
    title: {
        fontSize: '24px',
        letterSpacing: '2px',
        color: 'rgba(255, 255, 255, 0.9)',
        margin: 0
    },
    timestamp: {
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.5)'
    },
    statusBar: {
        padding: '8px 16px',
        fontSize: '12px',
        border: '1px solid',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center'
    },
    statusReady: {
        borderColor: 'rgba(234, 179, 8, 0.5)',
        color: '#eab308'
    },
    panel: {
        position: 'relative' as const,
        backgroundColor: '#000',
        border: '1px solid #fff',
        marginBottom: '32px',
        padding: '24px'
    },
    cornerAccent: {
        position: 'absolute' as const,
        width: '16px',
        height: '16px',
        borderStyle: 'solid',
        borderColor: '#fff'
    },
    uploadArea: {
        width: '100%',
        padding: '32px 16px',
        border: '1px dashed #fff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        transition: 'border-color 0.3s',
        backgroundColor: 'transparent'
    },
    uploadAreaHover: {
        borderColor: 'rgba(255, 255, 255, 0.5)'
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        fontSize: '14px',
        backgroundColor: '#000',
        border: '1px solid #fff',
        color: '#fff',
        fontFamily: "'Courier New', Courier, monospace"
    },
    select: {
        width: '100%',
        padding: '8px 12px',
        fontSize: '14px',
        backgroundColor: '#000',
        border: '1px solid #fff',
        color: '#fff',
        fontFamily: "'Courier New', Courier, monospace",
        cursor: 'pointer'
    },
    label: {
        display: 'block',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '8px',
        textTransform: 'uppercase' as const
    },
    table: {
        width: '100%',
        fontSize: '12px',
        borderCollapse: 'collapse' as const
    },
    th: {
        padding: '12px 16px',
        textAlign: 'left' as const,
        borderBottom: '1px solid #fff',
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: 'normal'
    },
    td: {
        padding: '12px 16px',
        borderBottom: '1px solid #fff'
    },
    row: {
        transition: 'background-color 0.2s'
    },
    smiles: {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#60a5fa',
        maxWidth: '300px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const
    },
    progressBar: {
        width: '64px',
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginRight: '8px',
        display: 'inline-block',
        position: 'relative' as const
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#22c55e',
        transition: 'width 0.3s'
    },
    cliffScore: {
        padding: '4px 8px',
        fontSize: '12px',
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        color: '#c084fc',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        display: 'inline-block'
    },
    error: {
        display: 'flex',
        alignItems: 'center',
        color: '#ef4444',
        fontSize: '12px',
        marginTop: '24px'
    },
    rangeSlider: {
        width: '100%',
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        appearance: 'none' as const,
        cursor: 'pointer',
        outline: 'none'
    }
};

// Custom terminal panel component
const TerminalPanel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style = {} }) => (
    <div style={{ ...styles.panel, ...style }}>
        <div style={{ ...styles.cornerAccent, top: '-2px', left: '-2px', borderWidth: '3px 0 0 3px' }} />
        <div style={{ ...styles.cornerAccent, top: '-2px', right: '-2px', borderWidth: '3px 3px 0 0' }} />
        <div style={{ ...styles.cornerAccent, bottom: '-2px', left: '-2px', borderWidth: '0 0 3px 3px' }} />
        <div style={{ ...styles.cornerAccent, bottom: '-2px', right: '-2px', borderWidth: '0 3px 3px 0' }} />
        {children}
    </div>
);

export default function ActivityCliffAnalyzer() {
    const [compounds, setCompounds] = useState<Compound[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
    const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([]);
    const [calculatingPairs, setCalculatingPairs] = useState(false);
    const [uploadHover, setUploadHover] = useState(false);

    const [rawData, setRawData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [smilesColumn, setSmilesColumn] = useState<string>('');
    const [selectedActivityColumn, setSelectedActivityColumn] = useState<string>('');

    // Advanced SMILES-based similarity (fallback for Claude environment)
    const calculateSimilarity = (smiles1: string, smiles2: string): number => {
        // Extract chemical features from SMILES
        const extractFeatures = (smiles: string) => {
            const features = {
                rings: (smiles.match(/\d/g) || []).length,
                aromaticRings: (smiles.toLowerCase().match(/c/g) || []).length,
                branches: (smiles.match(/\(/g) || []).length,
                doubleBonds: (smiles.match(/=/g) || []).length,
                tripleBonds: (smiles.match(/#/g) || []).length,
                heteroatoms: (smiles.match(/[NOSPFClBrI]/g) || []).length,
                length: smiles.length,
                // Functional groups
                carbonyl: (smiles.match(/C\(=O\)/g) || []).length,
                hydroxyl: (smiles.match(/O[H]?(?![A-Z])/g) || []).length,
                amine: (smiles.match(/N(?![A-Z])/g) || []).length,
                ether: (smiles.match(/COC/g) || []).length,
                halogen: (smiles.match(/[FClBrI]/g) || []).length,
            };
            return features;
        };

        const feat1 = extractFeatures(smiles1);
        const feat2 = extractFeatures(smiles2);

        // Calculate similarity for each feature
        const featureSimilarity = (a: number, b: number) => {
            if (a === 0 && b === 0) return 1;
            return 1 - Math.abs(a - b) / (a + b);
        };

        // Calculate weighted similarity
        const similarities = [
            featureSimilarity(feat1.rings, feat2.rings) * 0.15,
            featureSimilarity(feat1.aromaticRings, feat2.aromaticRings) * 0.15,
            featureSimilarity(feat1.branches, feat2.branches) * 0.1,
            featureSimilarity(feat1.doubleBonds, feat2.doubleBonds) * 0.1,
            featureSimilarity(feat1.heteroatoms, feat2.heteroatoms) * 0.15,
            featureSimilarity(feat1.carbonyl, feat2.carbonyl) * 0.1,
            featureSimilarity(feat1.amine, feat2.amine) * 0.1,
            featureSimilarity(feat1.halogen, feat2.halogen) * 0.1,
            featureSimilarity(feat1.length, feat2.length) * 0.05,
        ];

        return similarities.reduce((a, b) => a + b, 0);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');
        setCompounds([]);
        setRawData([]);
        setColumns([]);
        setSmilesColumn('');
        setSelectedActivityColumn('');
        setMatchedPairs([]);

        Papa.parse(file, {
            complete: (result) => {
                try {
                    const data = result.data as any[];
                    if (data.length === 0) {
                        throw new Error('CSV file is empty');
                    }

                    const headers = Object.keys(data[0] || {});
                    setColumns(headers);
                    setRawData(data);

                    const detectedSmilesCol = headers.find(h => {
                        const lower = h.toLowerCase();
                        return lower.includes('smile') ||
                            lower === 'structure' ||
                            lower === 'smiles' ||
                            lower === 'canonical_smiles' ||
                            lower === 'isomeric_smiles';
                    });

                    if (!detectedSmilesCol) {
                        const sampleRow = data[0];
                        const likelySmilesCol = headers.find(h => {
                            const value = sampleRow[h];
                            return typeof value === 'string' &&
                                value.length > 5 &&
                                /[CNOcn\(\)\[\]=]/.test(value);
                        });

                        if (likelySmilesCol) {
                            setSmilesColumn(likelySmilesCol);
                        } else {
                            setError('Could not auto-detect SMILES column. Please ensure your CSV contains molecular structures.');
                        }
                    } else {
                        setSmilesColumn(detectedSmilesCol);
                    }

                    setLoading(false);
                } catch (err) {
                    setError('Error parsing CSV: ' + (err as Error).message);
                    setLoading(false);
                }
            },
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
    };

    const processData = async () => {
        if (!selectedActivityColumn || !smilesColumn) return;

        try {
            const processedCompounds: Compound[] = rawData
                .filter(row => row[smilesColumn] && row[selectedActivityColumn] !== null && row[selectedActivityColumn] !== undefined)
                .map((row, idx) => ({
                    smiles: String(row[smilesColumn]).trim(),
                    activity: parseFloat(row[selectedActivityColumn]),
                    id: `compound_${idx + 1}`
                }))
                .filter(c => !isNaN(c.activity) && c.smiles.length > 0);

            if (processedCompounds.length === 0) {
                setError('No valid compounds found with both SMILES and activity values');
                return;
            }

            setCompounds(processedCompounds);
            setError('');
            await calculateMatchedPairs(processedCompounds);
        } catch (err) {
            setError('Error processing data: ' + (err as Error).message);
        }
    };

    const calculateMatchedPairs = async (compoundList: Compound[]) => {
        setCalculatingPairs(true);
        const pairs: MatchedPair[] = [];

        try {
            for (let i = 0; i < compoundList.length; i++) {
                for (let j = i + 1; j < compoundList.length; j++) {
                    const similarity = calculateSimilarity(
                        compoundList[i].smiles,
                        compoundList[j].smiles
                    );

                    if (similarity >= similarityThreshold) {
                        const activityDiff = Math.abs(compoundList[i].activity - compoundList[j].activity);
                        const cliffScore = similarity * activityDiff;

                        pairs.push({
                            compound1: compoundList[i],
                            compound2: compoundList[j],
                            similarity,
                            activityDiff,
                            cliffScore
                        });
                    }
                }
            }

            pairs.sort((a, b) => b.cliffScore - a.cliffScore);
            setMatchedPairs(pairs);
        } catch (err) {
            setError('Error calculating matched pairs: ' + (err as Error).message);
        } finally {
            setCalculatingPairs(false);
        }
    };

    useEffect(() => {
        if (selectedActivityColumn && smilesColumn && rawData.length > 0) {
            processData();
        }
    }, [selectedActivityColumn]);

    useEffect(() => {
        if (compounds.length > 0) {
            calculateMatchedPairs(compounds);
        }
    }, [similarityThreshold]);

    const numericColumns = useMemo(() => {
        if (rawData.length === 0) return [];

        return columns.filter(col => {
            const sample = rawData.slice(0, Math.min(10, rawData.length));
            return sample.some(row => {
                const val = row[col];
                return val !== null && val !== undefined && !isNaN(parseFloat(val));
            });
        });
    }, [columns, rawData]);

    const currentTime = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return (
        <div style={styles.app}>
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>ACTIVITY CLIFF ANALYZER</h1>
                    <div style={styles.timestamp}>Last Update {currentTime}</div>
                </div>

                <div style={{
                    ...styles.statusBar,
                    ...styles.statusReady
                }}>
                    <span>► SYSTEM READY :: SMILES-BASED SIMILARITY :: DEMO MODE</span>
                </div>

                <TerminalPanel>
                    <h2 style={{ fontSize: '14px', letterSpacing: '1px', marginBottom: '24px', color: 'rgba(255, 255, 255, 0.7)' }}>
                        FILE UPLOAD
                    </h2>

                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '12px' }}>
                            ACCEPTED FORMAT: CSV WITH SMILES AND ACTIVITY DATA
                        </div>
                        <label
                            style={{
                                ...styles.uploadArea,
                                ...(uploadHover ? styles.uploadAreaHover : {})
                            }}
                            onMouseEnter={() => setUploadHover(true)}
                            onMouseLeave={() => setUploadHover(false)}
                        >
                            <Upload size={32} style={{ marginBottom: '12px', color: 'rgba(255, 255, 255, 0.5)' }} />
                            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>DROP FILE OR CLICK TO UPLOAD</span>
                            <input
                                type="file"
                                style={{ display: 'none' }}
                                accept=".csv"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>

                    {columns.length > 0 && (
                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div>
                                <label style={styles.label}>SMILES COLUMN [AUTO-DETECTED]</label>
                                <div style={{ ...styles.input, color: '#22c55e' }}>
                                    {smilesColumn || 'NOT DETECTED'}
                                </div>
                            </div>

                            <div>
                                <label style={styles.label}>SELECT ACTIVITY COLUMN</label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={selectedActivityColumn}
                                        onChange={(e) => setSelectedActivityColumn(e.target.value)}
                                        style={styles.select}
                                    >
                                        <option value="">-- SELECT COLUMN --</option>
                                        {numericColumns.map(col => (
                                            <option key={col} value={col}>
                                                {col}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'rgba(255, 255, 255, 0.4)',
                                        pointerEvents: 'none'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {compounds.length > 0 && (
                        <div style={{ marginTop: '24px' }}>
                            <label style={styles.label}>
                                SIMILARITY THRESHOLD: {similarityThreshold.toFixed(2)}
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="0.95"
                                step="0.05"
                                value={similarityThreshold}
                                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                                style={{
                                    ...styles.rangeSlider,
                                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${(similarityThreshold - 0.5) / 0.45 * 100}%, rgba(255,255,255,0.2) ${(similarityThreshold - 0.5) / 0.45 * 100}%, rgba(255,255,255,0.2) 100%)`
                                }}
                            />
                        </div>
                    )}

                    {error && (
                        <div style={styles.error}>
                            <AlertCircle size={16} style={{ marginRight: '8px' }} />
                            ERROR: {error}
                        </div>
                    )}

                    {loading && (
                        <div style={{ color: 'rgba(255, 255, 255, 0.5)', marginTop: '24px', fontSize: '12px' }}>
                            PROCESSING FILE...
                        </div>
                    )}

                    {compounds.length > 0 && (
                        <div style={{ marginTop: '24px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            <div>► COMPOUNDS LOADED: {compounds.length}</div>
                            <div>► ACTIVITY COLUMN: {selectedActivityColumn}</div>
                            {calculatingPairs ? (
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                                    <Loader2 size={12} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                                    CALCULATING MOLECULAR SIMILARITIES...
                                </div>
                            ) : (
                                matchedPairs.length > 0 && <div>► MATCHED PAIRS: {matchedPairs.length}</div>
                            )}
                        </div>
                    )}
                </TerminalPanel>

                {matchedPairs.length > 0 && (
                    <TerminalPanel>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '14px', letterSpacing: '1px', color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
                                ACTIVITY CLIFF ANALYSIS
                            </h2>
                            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                SHOWING TOP {Math.min(50, matchedPairs.length)} RESULTS
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>RANK</th>
                                        <th style={styles.th}>COMPOUND_1</th>
                                        <th style={styles.th}>{selectedActivityColumn}_1</th>
                                        <th style={styles.th}>COMPOUND_2</th>
                                        <th style={styles.th}>{selectedActivityColumn}_2</th>
                                        <th style={styles.th}>SIMILARITY</th>
                                        <th style={styles.th}>ΔACTIVITY</th>
                                        <th style={styles.th}>CLIFF_SCORE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matchedPairs.slice(0, 50).map((pair, idx) => (
                                        <tr key={idx} style={styles.row} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <td style={{ ...styles.td, color: 'rgba(255, 255, 255, 0.7)' }}>
                                                {String(idx + 1).padStart(3, '0')}
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.smiles} title={pair.compound1.smiles}>
                                                    {pair.compound1.smiles}
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{pair.compound1.activity.toFixed(3)}</span>
                                                    {pair.compound1.activity > pair.compound2.activity ? (
                                                        <TrendingUp size={12} style={{ marginLeft: '8px', color: '#22c55e' }} />
                                                    ) : (
                                                        <TrendingDown size={12} style={{ marginLeft: '8px', color: '#ef4444' }} />
                                                    )}
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.smiles} title={pair.compound2.smiles}>
                                                    {pair.compound2.smiles}
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{pair.compound2.activity.toFixed(3)}</span>
                                                    {pair.compound2.activity > pair.compound1.activity ? (
                                                        <TrendingUp size={12} style={{ marginLeft: '8px', color: '#22c55e' }} />
                                                    ) : (
                                                        <TrendingDown size={12} style={{ marginLeft: '8px', color: '#ef4444' }} />
                                                    )}
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <div style={styles.progressBar}>
                                                        <div style={{ ...styles.progressFill, width: `${pair.similarity * 100}%` }} />
                                                    </div>
                                                    <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                                        {(pair.similarity * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ ...styles.td, color: 'rgba(255, 255, 255, 0.9)' }}>
                                                {pair.activityDiff.toFixed(3)}
                                            </td>
                                            <td style={styles.td}>
                                                <span style={styles.cliffScore}>
                                                    {pair.cliffScore.toFixed(3)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </TerminalPanel>
                )}
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          background: #10b981;
          border: 2px solid #000;
          cursor: pointer;
          margin-top: -4px;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          background: #10b981;
          border: 2px solid #000;
          cursor: pointer;
          border-radius: 0;
        }
      `}</style>
        </div>
    );
}