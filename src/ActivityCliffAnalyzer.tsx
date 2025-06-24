import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Upload, AlertCircle, TrendingUp, TrendingDown, ChevronDown, Loader2, Search } from 'lucide-react';
import Papa from 'papaparse';
import { loadRDKit } from './rdkit';

interface Compound {
    smiles: string;
    activity: number;
    id: string;
    compoundId: string;
    svg: string;
}

interface MatchedPair {
    compound1: Compound;
    compound2: Compound;
    similarity: number;
    activityDiff: number;
    foldChange: number;
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
        padding: '16px 20px',
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
        whiteSpace: 'nowrap' as const,
        cursor: 'pointer'
    },
    compoundId: {
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center' as const,
        marginTop: '4px',
        fontFamily: "'Courier New', Courier, monospace"
    },
    molImg: {
        width: '200px',
        height: '160px',
        border: 'none'
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
    const [processingData, setProcessingData] = useState(false);
    const [error, setError] = useState<string>('');
    const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([]);
    const [calculatingPairs, setCalculatingPairs] = useState(false);
    const [calculationProgress, setCalculationProgress] = useState<{ current: number; total: number } | null>(null);
    const [uploadHover, setUploadHover] = useState(false);
    const [duplicateStats, setDuplicateStats] = useState<{ totalEntries: number; uniqueCompounds: number; duplicatesRemoved: number } | null>(null);

    const [rawData, setRawData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [smilesColumn, setSmilesColumn] = useState<string>('');
    const [compoundIdColumn, setCompoundIdColumn] = useState<string>('');
    const [autoDetectedCompoundIdColumn, setAutoDetectedCompoundIdColumn] = useState<string>('');
    const [selectedActivityColumn, setSelectedActivityColumn] = useState<string>('');
    const [copiedSmiles, setCopiedSmiles] = useState<string>('');
    const [hideZeroActivity, setHideZeroActivity] = useState<boolean>(true);
    const [hideSimilarityColumn, setHideSimilarityColumn] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<string>('score');

    // Search functionality state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchResults, setSearchResults] = useState<MatchedPair[]>([]);
    const [searchError, setSearchError] = useState<string>('');

    // Ref for smooth progress bar animation
    const progressBarRef = useRef<HTMLDivElement>(null);
    const progressAnimationRef = useRef<number | null>(null);

    // Smooth progress update function
    const updateProgressSmoothly = (current: number, total: number) => {
        if (progressBarRef.current) {
            const percentage = (current / total) * 100;
            progressBarRef.current.style.width = `${percentage}%`;
        }
        // Update the text display less frequently to avoid React batching issues
        setCalculationProgress({ current, total });
    };

    // Tanimoto similarity based on Morgan fingerprints
    const calculateSimilarity = (RDKit: any, s1: string, s2: string): number => {
        try {
            const mol1 = RDKit.get_mol(s1);
            const mol2 = RDKit.get_mol(s2);
            const fp1 = mol1.get_morgan_fp_as_uint8array();
            const fp2 = mol2.get_morgan_fp_as_uint8array();
            const popcnt = (arr: Uint8Array) => {
                let c = 0;
                for (let i = 0; i < arr.length; i++) {
                    let v = arr[i];
                    while (v) {
                        v &= v - 1;
                        c++;
                    }
                }
                return c;
            };
            const popcntAnd = (a: Uint8Array, b: Uint8Array) => {
                let c = 0;
                for (let i = 0; i < a.length; i++) {
                    let v = a[i] & b[i];
                    while (v) {
                        v &= v - 1;
                        c++;
                    }
                }
                return c;
            };
            const ab = popcntAnd(fp1, fp2);
            const a = popcnt(fp1);
            const b = popcnt(fp2);
            mol1.delete();
            mol2.delete();
            if (a + b - ab === 0) return 0;
            return ab / (a + b - ab);
        } catch (e) {
            console.error('similarity calc failed', e);
            return 0;
        }
    };

    const getCompoundSVG = (RDKit: any, smiles: string): string => {
        let mol;
        try {
            mol = RDKit.get_mol(smiles);

            const drawingParams = {
                width: 200,
                height: 150,
                backgroundColour: [0, 0, 0, 0], // Black background
                atomColourPalette: {
                    6: [0.25, 0.25, 0.25],   // C - Light grey
                },
            };

            const svg = mol.get_svg_with_highlights(JSON.stringify(drawingParams));
            return svg;
        } catch (e) {
            console.error('SVG generation failed', e);
            return mol ? mol.get_svg() : '';
        } finally {
            if (mol) mol.delete();
        }
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
        setCompoundIdColumn('');
        setAutoDetectedCompoundIdColumn('');
        setSelectedActivityColumn('');
        setMatchedPairs([]);
        setDuplicateStats(null);

        // Process CSV in background to prevent UI hanging
        setTimeout(() => {
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

                        // Auto-detect compound ID column
                        const detectedCompoundIdCol = headers.find(h => {
                            const lower = h.toLowerCase();
                            return lower.includes('id') ||
                                lower.includes('index') ||
                                lower.includes('compound') ||
                                lower.includes('name') ||
                                lower.includes('identifier') ||
                                lower === 'compound_id' ||
                                lower === 'compound_name' ||
                                lower === 'molecule_id' ||
                                lower === 'mol_id';
                        });

                        if (detectedCompoundIdCol) {
                            setCompoundIdColumn(detectedCompoundIdCol);
                            setAutoDetectedCompoundIdColumn(detectedCompoundIdCol);
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
        }, 0);
    };

    const processData = async () => {
        if (!selectedActivityColumn || !smilesColumn) return;

        try {
            // First, collect all compounds with their activities
            const compoundMap = new Map<string, { smiles: string; activities: number[]; id: string; compoundId: string }>();

            rawData
                .filter(row => row[smilesColumn] && row[selectedActivityColumn] !== null && row[selectedActivityColumn] !== undefined)
                .forEach((row, idx) => {
                    const smiles = String(row[smilesColumn]).trim();
                    const activity = parseFloat(row[selectedActivityColumn]);
                    const compoundId = compoundIdColumn && row[compoundIdColumn]
                        ? String(row[compoundIdColumn]).trim()
                        : `compound_${idx + 1}`;

                    if (!isNaN(activity) && smiles.length > 0) {
                        if (compoundMap.has(smiles)) {
                            // Add to existing compound's activities
                            compoundMap.get(smiles)!.activities.push(activity);
                        } else {
                            // Create new compound entry
                            compoundMap.set(smiles, {
                                smiles,
                                activities: [activity],
                                id: `compound_${idx + 1}`,
                                compoundId: compoundId,
                            });
                        }
                    }
                });

            // Convert to processed compounds with average activities
            const processedCompoundsWithoutSvg: Omit<Compound, 'svg'>[] = Array.from(compoundMap.values())
                .map((compound, idx) => {
                    const avgActivity = compound.activities.reduce((sum, act) => sum + act, 0) / compound.activities.length;
                    return {
                        smiles: compound.smiles,
                        activity: avgActivity,
                        id: `compound_${idx + 1}`,
                        compoundId: compound.compoundId,
                    };
                });

            if (processedCompoundsWithoutSvg.length === 0) {
                setError('No valid compounds found with both SMILES and activity values');
                setProcessingData(false);
                return;
            }

            // Calculate duplicate removal statistics
            const totalEntries = rawData.filter(row => row[smilesColumn] && row[selectedActivityColumn] !== null && row[selectedActivityColumn] !== undefined).length;
            const uniqueCompounds = processedCompoundsWithoutSvg.length;
            const duplicatesRemoved = totalEntries - uniqueCompounds;

            setDuplicateStats({ totalEntries, uniqueCompounds, duplicatesRemoved });

            // Load RDKit and generate SVGs for all compounds
            const RDKit = await loadRDKit();
            const processedCompounds: Compound[] = processedCompoundsWithoutSvg.map(compound => ({
                ...compound,
                svg: getCompoundSVG(RDKit, compound.smiles)
            }));

            setCompounds(processedCompounds);
            setError('');
            await calculateMatchedPairs(processedCompounds);
        } catch (err) {
            setError('Error processing data: ' + (err as Error).message);
        } finally {
            setProcessingData(false);
        }
    };

    const calculateMatchedPairs = async (compoundList: Compound[]) => {
        setCalculatingPairs(true);
        setCalculationProgress(null);
        const pairs: MatchedPair[] = [];
        const similarityThreshold = 0.7; // Fixed threshold

        try {
            const RDKit = await loadRDKit();

            const totalComparisons = (compoundList.length * (compoundList.length - 1)) / 2;
            let completedComparisons = 0;
            let lastTextUpdate = 0;

            // Initialize progress bar
            updateProgressSmoothly(0, totalComparisons);

            const processChunk = async (chunk: { i: number, j: number }[]) => {
                for (const { i, j } of chunk) {
                    const similarity = calculateSimilarity(RDKit, compoundList[i].smiles, compoundList[j].smiles);

                    if (similarity >= similarityThreshold) {
                        const activityDiff = Math.abs(compoundList[i].activity - compoundList[j].activity);
                        if (activityDiff === 0) continue;
                        const foldChange = compoundList[i].activity > compoundList[j].activity ? compoundList[i].activity / compoundList[j].activity : compoundList[j].activity / compoundList[i].activity;
                        const cliffScore = similarity * similarity * similarity * activityDiff;

                        pairs.push({
                            compound1: { ...compoundList[i] },
                            compound2: { ...compoundList[j] },
                            similarity,
                            activityDiff,
                            foldChange,
                            cliffScore,
                        });
                    }
                    completedComparisons++;
                }

                // Update progress bar smoothly every frame
                if (progressAnimationRef.current) {
                    cancelAnimationFrame(progressAnimationRef.current);
                }
                progressAnimationRef.current = requestAnimationFrame(() => {
                    updateProgressSmoothly(completedComparisons, totalComparisons);
                });

                // Update text less frequently to avoid React batching issues
                const now = performance.now();
                if (now - lastTextUpdate >= 100) { // Update text every 100ms
                    setCalculationProgress({ current: completedComparisons, total: totalComparisons });
                    lastTextUpdate = now;
                }
            };

            const allComparisons: { i: number, j: number }[] = [];
            for (let i = 0; i < compoundList.length; i++) {
                for (let j = i + 1; j < compoundList.length; j++) {
                    allComparisons.push({ i, j });
                }
            }

            // Smaller chunk size for more frequent progress updates
            const chunkSize = 200; // Even smaller for smoother animation
            for (let i = 0; i < allComparisons.length; i += chunkSize) {
                const chunk = allComparisons.slice(i, i + chunkSize);
                await processChunk(chunk);
                // Brief yield to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 1));
            }

            // Final progress update
            updateProgressSmoothly(totalComparisons, totalComparisons);
            setCalculationProgress({ current: totalComparisons, total: totalComparisons });

            pairs.sort((a, b) => b.cliffScore - a.cliffScore);
            setMatchedPairs(pairs);

        } catch (err) {
            setError('Error calculating matched pairs: ' + (err as Error).message);
        } finally {
            // Clean up animation frame
            if (progressAnimationRef.current) {
                cancelAnimationFrame(progressAnimationRef.current);
            }
            setCalculatingPairs(false);
            setCalculationProgress(null);
        }
    };

    useEffect(() => {
        if (selectedActivityColumn && smilesColumn && rawData.length > 0) {
            // Set processing state immediately for better UX
            setProcessingData(true);
            setError('');
            // Use a micro-task to ensure the UI updates before starting the heavy computation
            Promise.resolve().then(() => {
                processData();
            });
        }
    }, [selectedActivityColumn, compoundIdColumn]);

    // Cleanup animation frames on unmount
    useEffect(() => {
        return () => {
            if (progressAnimationRef.current) {
                cancelAnimationFrame(progressAnimationRef.current);
            }
        };
    }, []);

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

    // Filter matched pairs based on zero activity setting
    const filteredMatchedPairs = useMemo(() => {
        if (!hideZeroActivity) return matchedPairs;
        return matchedPairs.filter(pair =>
            pair.compound1.activity !== 0 && pair.compound2.activity !== 0
        );
    }, [matchedPairs, hideZeroActivity]);

    // Sort matched pairs based on selected sort option
    const sortedMatchedPairs = useMemo(() => {
        const sorted = [...filteredMatchedPairs];
        switch (sortBy) {
            case 'activity':
                return sorted.sort((a, b) => b.activityDiff - a.activityDiff);
            case 'fold':
                return sorted.sort((a, b) => b.foldChange - a.foldChange);
            case 'similarity':
                return sorted.sort((a, b) => b.similarity - a.similarity);
            case 'score':
            default:
                return sorted.sort((a, b) => b.cliffScore - a.cliffScore);
        }
    }, [filteredMatchedPairs, sortBy]);

    // Function to handle SMILES copy with tooltip feedback
    const handleSmilesCopy = async (smiles: string) => {
        try {
            await navigator.clipboard.writeText(smiles);
            setCopiedSmiles(smiles);
            // Reset the copied state after 3 seconds
            setTimeout(() => {
                setCopiedSmiles('');
            }, 3000);
        } catch (err) {
            console.error('Failed to copy SMILES:', err);
        }
    };

    // Search functionality using RDKit substructure matching
    const performSearch = async () => {
        if (!searchQuery.trim() || matchedPairs.length === 0) return;

        setIsSearching(true);
        setSearchError('');
        setSearchResults([]);

        try {
            const RDKit = await loadRDKit();

            // Create query molecule (SMARTS)
            const qmol = RDKit.get_qmol(searchQuery.trim());
            if (!qmol) {
                throw new Error('Invalid SMILES/SMARTS query');
            }

            const matchingPairs: MatchedPair[] = [];

            for (const pair of matchedPairs) {
                // Check if query matches either compound in the pair
                const mol1 = RDKit.get_mol(pair.compound1.smiles);
                const mol2 = RDKit.get_mol(pair.compound2.smiles);

                if (!mol1 || !mol2) {
                    if (mol1) mol1.delete();
                    if (mol2) mol2.delete();
                    continue;
                }

                // Check for substructure matches
                const match1 = JSON.parse(mol1.get_substruct_match(qmol));
                const match2 = JSON.parse(mol2.get_substruct_match(qmol));

                if ((match1 || match2) && ((match1["bonds"] && match1["bonds"].length > 0) || (match2["bonds"] && match2["bonds"].length > 0))) {
                    // Create highlighted SVGs for matching compounds
                    const highlightedSvg1 = match1
                        ? getHighlightedSVG(RDKit, mol1, match1)
                        : pair.compound1.svg;

                    const highlightedSvg2 = match2
                        ? getHighlightedSVG(RDKit, mol2, match2)
                        : pair.compound2.svg;

                    matchingPairs.push({
                        ...pair,
                        compound1: { ...pair.compound1, svg: highlightedSvg1 },
                        compound2: { ...pair.compound2, svg: highlightedSvg2 }
                    });
                }

                mol1.delete();
                mol2.delete();
            }

            qmol.delete();
            setSearchResults(matchingPairs);

        } catch (err) {
            setSearchError('Search error: ' + (err as Error).message);
        } finally {
            setIsSearching(false);
        }
    };

    // Generate highlighted SVG for substructure matches
    const getHighlightedSVG = (RDKit: any, mol: any, match: any): string => {
        try {
            const drawingParams = {
                width: 200,
                height: 150,
                backgroundColour: [0, 0, 0, 0], // Black background
                atomColourPalette: {
                    6: [0.25, 0.25, 0.25],   // C - Light grey
                },
                highlightColour: [1, 0.5, 0, 0.75], // Orange highlight for matches
                // atoms: match["atoms"],
                bonds: match["bonds"]
            };

            const svg = mol.get_svg_with_highlights(JSON.stringify(drawingParams));
            return svg;
        } catch (e) {
            console.error('Highlighted SVG generation failed', e);
            return getCompoundSVG(RDKit, mol ? mol.get_smiles() : '');
        }
    };

    // Handle search form submission
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch();
    };

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
                                <label style={styles.label}>
                                    SELECT COMPOUND ID COLUMN
                                    {autoDetectedCompoundIdColumn && compoundIdColumn === autoDetectedCompoundIdColumn && (
                                        <span style={{ color: '#22c55e', marginLeft: '8px' }}>[AUTO-DETECTED]</span>
                                    )}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={compoundIdColumn}
                                        onChange={(e) => setCompoundIdColumn(e.target.value)}
                                        style={styles.select}
                                    >
                                        <option value="">-- AUTO-GENERATED IDS --</option>
                                        {columns.map(col => (
                                            <option key={col} value={col}>
                                                {col}{col === autoDetectedCompoundIdColumn ? ' [AUTO-DETECTED]' : ''}
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

                    {error && (
                        <div style={styles.error}>
                            <AlertCircle size={16} style={{ marginRight: '8px' }} />
                            ERROR: {error}
                        </div>
                    )}

                    {loading && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: '24px',
                            padding: '32px',
                            border: '1px dashed rgba(255, 255, 255, 0.3)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <Loader2 size={32} style={{
                                marginBottom: '16px',
                                color: '#22c55e',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <div style={{
                                fontSize: '14px',
                                color: 'rgba(255, 255, 255, 0.7)',
                                marginBottom: '8px'
                            }}>
                                PROCESSING CSV FILE...
                            </div>
                            <div style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.5)',
                                textAlign: 'center'
                            }}>
                                Reading file data and parsing CSV structure...
                                <br />
                                This may take a moment for large files
                            </div>
                        </div>
                    )}

                    {processingData && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: '24px',
                            padding: '32px',
                            border: '1px dashed rgba(255, 255, 255, 0.3)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <div style={{
                                fontSize: '14px',
                                color: 'rgba(255, 255, 255, 0.7)',
                                marginBottom: '8px'
                            }}>
                                {calculatingPairs ? 'CALCULATING SIMILARITIES...' : 'PROCESSING COMPOUND DATA...'}
                            </div>
                            <div style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.5)',
                                textAlign: 'center',
                                marginBottom: calculationProgress ? '16px' : '0'
                            }}>
                                {calculatingPairs
                                    ? 'Analyzing molecular similarities and generating activity cliffs...'
                                    : 'Analyzing compounds and calculating similarities...'
                                }
                                <br />
                                This may take a moment for large datasets
                            </div>
                            {calculationProgress && (
                                <div style={{ width: '100%', maxWidth: '300px' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '10px',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        marginBottom: '8px'
                                    }}>
                                        <span>Progress</span>
                                        <span>{calculationProgress.current.toLocaleString()} / {calculationProgress.total.toLocaleString()}</span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '4px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                    }}>
                                        <div
                                            ref={progressBarRef}
                                            style={{
                                                width: '0%',
                                                height: '100%',
                                                backgroundColor: '#22c55e',
                                                transition: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {compounds.length > 0 && (
                        <div style={{ marginTop: '24px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            <div>► COMPOUNDS LOADED: {compounds.length}</div>
                            <div>► ACTIVITY COLUMN: {selectedActivityColumn}</div>
                            <div>► COMPOUND ID COLUMN: {compoundIdColumn || 'AUTO-GENERATED'}</div>
                            {duplicateStats && duplicateStats.duplicatesRemoved > 0 && (
                                <div style={{ color: '#f59e0b', marginTop: '4px' }}>
                                    ► DUPLICATES REMOVED: {duplicateStats.duplicatesRemoved} entries → {duplicateStats.uniqueCompounds} unique compounds
                                </div>
                            )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={hideZeroActivity}
                                        onChange={(e) => setHideZeroActivity(e.target.checked)}
                                        style={{
                                            marginRight: '8px',
                                            width: '14px',
                                            height: '14px',
                                            accentColor: '#22c55e'
                                        }}
                                    />
                                    HIDE ZERO ACTIVITY
                                </label>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={hideSimilarityColumn}
                                        onChange={(e) => setHideSimilarityColumn(e.target.checked)}
                                        style={{
                                            marginRight: '8px',
                                            width: '14px',
                                            height: '14px',
                                            accentColor: '#22c55e'
                                        }}
                                    />
                                    HIDE SIMILARITY COLUMN
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                        SORT BY:
                                    </span>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        style={{
                                            ...styles.select,
                                            width: 'auto',
                                            fontSize: '11px',
                                            padding: '4px 8px',
                                            minWidth: '100px'
                                        }}
                                    >
                                        <option value="score">CLIFF SCORE</option>
                                        <option value="activity">ACTIVITY DIFF</option>
                                        <option value="fold">FOLD CHANGE</option>
                                        <option value="similarity">SIMILARITY</option>
                                    </select>
                                </div>
                                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                    SHOWING TOP {Math.min(50, sortedMatchedPairs.length)} RESULTS
                                </span>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div style={{ marginBottom: '24px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '12px', textTransform: 'uppercase' }}>
                                SUBSTRUCTURE SEARCH
                            </div>
                            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Enter SMILES/SMARTS query (e.g., c1ccccc1 for benzene ring)"
                                        style={{
                                            ...styles.input,
                                            width: '100%',
                                            fontSize: '12px',
                                            fontFamily: 'monospace'
                                        }}
                                        disabled={isSearching}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSearching || !searchQuery.trim()}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: isSearching || !searchQuery.trim() ? 'rgba(255, 255, 255, 0.1)' : '#22c55e',
                                        color: '#fff',
                                        border: 'none',
                                        cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontFamily: "'Courier New', Courier, monospace",
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    {isSearching ? (
                                        <>
                                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                            SEARCHING...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={14} />
                                            SEARCH
                                        </>
                                    )}
                                </button>
                                {searchResults.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSearchResults([]);
                                            setSearchError('');
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            color: '#fff',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontFamily: "'Courier New', Courier, monospace"
                                        }}
                                    >
                                        CLEAR
                                    </button>
                                )}
                            </form>
                            {searchError && (
                                <div style={{ ...styles.error, marginTop: '12px' }}>
                                    <AlertCircle size={14} style={{ marginRight: '8px' }} />
                                    {searchError}
                                </div>
                            )}
                            {searchResults.length > 0 && (
                                <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '12px' }}>
                                    ► FOUND {searchResults.length} MATCHING PAIRS
                                </div>
                            )}
                        </div>

                        {isSearching && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '48px',
                                border: '1px dashed rgba(255, 255, 255, 0.3)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                marginBottom: '24px'
                            }}>
                                <Loader2 size={32} style={{
                                    marginBottom: '16px',
                                    color: '#22c55e',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <div style={{
                                    fontSize: '14px',
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    marginBottom: '8px'
                                }}>
                                    SEARCHING FOR SUBSTRUCTURE MATCHES...
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    textAlign: 'center'
                                }}>
                                    Analyzing molecular structures and highlighting matches...
                                </div>
                            </div>
                        )}

                        {!isSearching && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>RANK</th>
                                            <th style={styles.th}>COMPOUND_1</th>
                                            <th style={styles.th}>{selectedActivityColumn}_1</th>
                                            <th style={styles.th}>COMPOUND_2</th>
                                            <th style={styles.th}>{selectedActivityColumn}_2</th>
                                            {!hideSimilarityColumn && <th style={styles.th}>SIMILARITY</th>}
                                            <th style={styles.th}>ΔACTIVITY</th>
                                            <th style={styles.th}>FOLD CHANGE</th>
                                            <th style={styles.th}>CLIFF_SCORE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(searchResults.length > 0 ? searchResults : sortedMatchedPairs).slice(0, 50).map((pair, idx) => (
                                            <tr key={idx} style={styles.row} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={{ ...styles.td, color: 'rgba(255, 255, 255, 0.7)' }}>
                                                    {String(idx + 1).padStart(3, '0')}
                                                </td>
                                                <td style={styles.td}>
                                                    <div
                                                        style={styles.molImg}
                                                        dangerouslySetInnerHTML={{ __html: pair.compound1.svg }}
                                                    />
                                                    <div
                                                        style={styles.smiles}
                                                        title={copiedSmiles === pair.compound1.smiles ? "copied" : "click to copy"}
                                                        onClick={() => handleSmilesCopy(pair.compound1.smiles)}
                                                    >
                                                        {pair.compound1.smiles}
                                                    </div>
                                                    <div style={styles.compoundId}>
                                                        COMPOUND {pair.compound1.compoundId}
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
                                                    <div
                                                        style={styles.molImg}
                                                        dangerouslySetInnerHTML={{ __html: pair.compound2.svg }}
                                                    />
                                                    <div
                                                        style={styles.smiles}
                                                        title={copiedSmiles === pair.compound2.smiles ? "copied" : "click to copy"}
                                                        onClick={() => handleSmilesCopy(pair.compound2.smiles)}
                                                    >
                                                        {pair.compound2.smiles}
                                                    </div>
                                                    <div style={styles.compoundId}>
                                                        COMPOUND {pair.compound2.compoundId}
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
                                                {!hideSimilarityColumn && (
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
                                                )}
                                                <td style={{ ...styles.td, color: 'rgba(255, 255, 255, 0.9)' }}>
                                                    {pair.activityDiff.toFixed(3)}
                                                </td>
                                                <td style={{ ...styles.td, color: 'rgba(255, 255, 255, 0.9)' }}>
                                                    {pair.foldChange.toFixed(3)}
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
                        )}
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