// Datastar auto-initializes from data-sse-endpoint attribute in index.html
// Just import it to ensure it's loaded
import '@starfederation/datastar';

if (typeof window !== 'undefined') {
  console.log('✅ Datastar will auto-initialize from data-sse-endpoint attribute');
}
