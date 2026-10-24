import { useState } from 'react';
import {
  Box, Typography, Paper, Chip, Divider, Tabs, Tab,
  Accordion, AccordionSummary, AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import { openApiSpec } from '../api/openapi';

const METHOD_COLORS = {
  get: { bg: '#10b981', label: 'GET' },
  post: { bg: '#2563eb', label: 'POST' },
  put: { bg: '#f59e0b', label: 'PUT' },
  patch: { bg: '#8b5cf6', label: 'PATCH' },
  delete: { bg: '#ef4444', label: 'DELETE' },
};

export function Docs() {
  const [tab, setTab] = useState(0);

  const endpoints = Object.entries(openApiSpec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, details]) => ({ path, method, ...details }))
  );

  const groupedByTag = {};
  endpoints.forEach((ep) => {
    const tag = ep.tags?.[0] || 'Other';
    if (!groupedByTag[tag]) groupedByTag[tag] = [];
    groupedByTag[tag].push(ep);
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        📘 API Документация
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        OpenAPI 3.0.3 спецификация Invoice Keeper API. Все эндпоинты используют префикс{' '}
        <code>/api/v1</code>.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <b>Сервер:</b> {openApiSpec.servers[0].url} &nbsp;|&nbsp;
        <b>Версия:</b> {openApiSpec.info.version} &nbsp;|&nbsp;
        <b>Auth:</b> JWT Bearer Token
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Эндпоинты (${endpoints.length})`} />
          <Tab label="Модели данных" />
          <Tab label="JSON спецификация" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Box>
          {Object.entries(groupedByTag).map(([tag, items]) => (
            <Box key={tag} sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {tag}
              </Typography>
              {items.map((ep, idx) => {
                const color = METHOD_COLORS[ep.method] || { bg: '#64748b', label: ep.method.toUpperCase() };
                return (
                  <Accordion key={idx} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Chip
                          label={color.label}
                          sx={{
                            bgcolor: color.bg,
                            color: 'white',
                            fontWeight: 'bold',
                            minWidth: 70,
                          }}
                        />
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                          {ep.path}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {ep.summary}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="subtitle2" gutterBottom>
                        {ep.summary}
                      </Typography>
                      {ep.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {ep.description}
                        </Typography>
                      )}

                      {ep.security && (
                        <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
                          🔒 Требуется авторизация: JWT Bearer Token
                        </Alert>
                      )}

                      {ep.requestBody && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Request Body:
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <pre style={{ margin: 0, fontSize: '0.85rem', overflow: 'auto' }}>
                              {JSON.stringify(ep.requestBody.content?.['application/json']?.schema || {}, null, 2)}
                            </pre>
                          </Paper>
                        </Box>
                      )}

                      <Divider sx={{ my: 1 }} />

                      <Typography variant="subtitle2" gutterBottom>
                        Responses:
                      </Typography>
                      {Object.entries(ep.responses || {}).map(([code, resp]) => (
                        <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            label={code}
                            size="small"
                            color={code.startsWith('2') ? 'success' : code.startsWith('4') ? 'error' : 'default'}
                          />
                          <Typography variant="body2">{resp.description}</Typography>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          {Object.entries(openApiSpec.components?.schemas || {}).map(([name, schema]) => (
            <Paper key={name} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon /> {name}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <pre style={{ margin: 0, fontSize: '0.85rem', overflow: 'auto' }}>
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </Paper>
            </Paper>
          ))}
        </Box>
      )}

      {tab === 2 && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: '70vh', overflow: 'auto' }}>
          <pre style={{ margin: 0, fontSize: '0.85rem' }}>
            {JSON.stringify(openApiSpec, null, 2)}
          </pre>
        </Paper>
      )}
    </Box>
  );
}